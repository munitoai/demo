#!/usr/bin/env bash
# Check every example: shell syntax, Python syntax, and the TypeScript types and build.
# Run it from the root of the repository, or through `mise run check`.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

failures=0
step() { printf '%-52s' "$1"; }
pass() { echo "ok"; }
fail() { echo "FAILED"; printf '    %s\n' "${1//$'\n'/$'\n'    }"; failures=$((failures + 1)); }

echo "== Shell"
while IFS= read -r script; do
  step "$script"
  if output=$(bash -n "$script" 2>&1); then
    if command -v shellcheck >/dev/null; then
      if output=$(shellcheck -x "$script" 2>&1); then pass; else fail "$output"; fi
    else
      pass
    fi
  else
    fail "$output"
  fi
done < <(git ls-files '*.sh')

echo
echo "== Python"
while IFS= read -r script; do
  step "$script"
  if output=$(python3 -m py_compile "$script" 2>&1); then pass; else fail "$output"; fi
done < <(git ls-files '*.py')

echo
echo "== TypeScript"
while IFS= read -r manifest; do
  folder=$(dirname "$manifest")
  node -e 'process.exit(require(process.argv[1]).scripts?.check ? 0 : 1)' "./$manifest" || continue
  step "$folder"
  if output=$(cd "$folder" && npm ci --no-audit --no-fund 2>&1 && npm run --silent check 2>&1); then
    pass
  else
    fail "$output"
  fi
done < <(git ls-files '*/package.json')

echo
if [ "$failures" -eq 0 ]; then
  echo "Every check passed."
else
  echo "$failures check(s) failed."
fi
exit "$failures"
