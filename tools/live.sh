#!/usr/bin/env bash
# Run the examples against the real API, and report which ones work.
#
#   export MUNITO_API_KEY="munitoai_..."
#   ./tools/live.sh              every example below
#   ./tools/live.sh ocr chat     only the examples whose name holds "ocr" or "chat"
#
# `.github/workflows/live.yml` runs this each day with a key for a test
# organization. Run it yourself with your own key before you change an example.
#
# It leaves out three things:
#
#   - `demos/place`, which needs a Terse account and an actor that the sandboxes
#     reach from the internet.
#   - `document-ai/ocr/typescript`, which is a browser app.
#   - the full fan-out, because 100 sandboxes prove nothing that 5 do not.
#
# One run starts about a dozen of the smallest sandboxes for a few seconds each,
# sends two short chat requests and reads one page. Each example deletes its own
# sandboxes, and the end of this script reports any that a failed run left.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

: "${MUNITO_API_KEY:?Set MUNITO_API_KEY to your Munito API key.}"
API="https://api.munito.ai/sandboxes/v1"

WANTED=("$@")
passed=0
failed=0
broken=""

# Whether to run the example named $1.
wanted() {
  [ "${#WANTED[@]}" -eq 0 ] && return 0
  local want
  for want in "${WANTED[@]}"; do
    case "$1" in *"$want"*) return 0 ;; esac
  done
  return 1
}

# run <folder> <command...>. The folder is also the name of the example.
run() {
  local folder=$1
  shift
  wanted "$folder" || return 0

  printf '\n== %s\n' "$folder"
  local started output status
  started=$SECONDS
  output=$( (cd "$folder" && "$@") 2>&1 )
  status=$?
  if [ "$status" -eq 0 ]; then
    passed=$((passed + 1))
    printf '   ok in %ss\n' "$((SECONDS - started))"
    # Keep the log short: the tail shows that the example reached its end.
    printf '%s\n' "$output" | tail -4 | sed 's/^/   | /'
  else
    failed=$((failed + 1))
    broken="$broken $folder"
    printf '   FAILED, exit %s after %ss\n' "$status" "$((SECONDS - started))"
    printf '%s\n' "$output" | tail -30 | sed 's/^/   | /'
  fi
}

# The two examples that use the OpenAI client need their packages.
for folder in sandboxes/code-interpreter/typescript inference/chat/typescript; do
  if wanted "$folder" && [ ! -d "$folder/node_modules" ]; then
    (cd "$folder" && npm ci --silent --no-audit --no-fund) || exit 1
  fi
done

run sandboxes/quickstart/curl              ./quickstart.sh
run sandboxes/quickstart/python            uv run --quiet quickstart.py
run sandboxes/quickstart/typescript        node quickstart.ts
run sandboxes/fan-out/python               uv run --quiet fan_out.py -n 5
run sandboxes/fan-out/typescript           node fan-out.ts --count 5
run sandboxes/code-interpreter/python      uv run --quiet interpreter.py "What is 2 to the power of 32?"
run sandboxes/code-interpreter/typescript  node interpreter.ts "What is 2 to the power of 32?"
run sandboxes/dev-preview/typescript       node preview.ts --minutes 1
run sandboxes/docker/curl                  ./docker.sh
run inference/chat/curl                    ./chat.sh "Reply with exactly: OK"
run inference/chat/python                  uv run --quiet chat.py "Reply with exactly: OK"
run inference/chat/typescript              node chat.ts "Reply with exactly: OK"
run document-ai/ocr/curl                   ./ocr.sh
run document-ai/ocr/python                 uv run --quiet ocr.py

# An example that fails can leave a sandbox behind. Each one stops at its own
# timeout, so this reports and deletes nothing: a delete could take a sandbox
# that another run started.
printf '\n== Sandboxes left running\n'
curl -sS "$API/sandboxes?status=running" -H "Authorization: Bearer $MUNITO_API_KEY" |
  python3 -c 'import json, sys
try:
    data = json.load(sys.stdin)["data"]
except Exception:
    print("   could not read the list")
    raise SystemExit(0)
print("   %d running in this organization" % len(data))
for s in data:
    print("   %s  %s" % (s["id"], s.get("metadata", {})))'

printf '\n== Result\n'
printf '   %s passed, %s failed\n' "$passed" "$failed"
for name in $broken; do printf '   FAILED  %s\n' "$name"; done
[ "$failed" -eq 0 ]
