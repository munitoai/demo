#!/usr/bin/env bash
# Run Docker in a sandbox, with the steps of the guide: https://docs.munito.ai/sandboxes#docker
#
#   ./docker.sh          the ubuntu template: Docker runs when the sandbox starts
#   ./docker.sh base     the base template: install Docker and start its daemon first
#
# Needs curl, jq, and a Munito API key in MUNITO_API_KEY.
set -euo pipefail

API="https://api.munito.ai/sandboxes/v1"
TEMPLATE=${1:-ubuntu}
: "${MUNITO_API_KEY:?Set MUNITO_API_KEY to your Munito API key.}"
command -v jq >/dev/null || { echo "Install jq first: https://jqlang.org/download/" >&2; exit 1; }
[ "$TEMPLATE" = ubuntu ] || [ "$TEMPLATE" = base ] || { echo "usage: $0 [ubuntu|base]" >&2; exit 2; }

api() { curl -sS --fail-with-body -H "Authorization: Bearer $MUNITO_API_KEY" "$@"; }

# Run one command in the sandbox and print its output while it runs ("stream": true gives NDJSON events).
# Fails when the command fails.
run() {
  echo "\$ $1"
  api -N "$API/sandboxes/$SANDBOX/exec" -H "Content-Type: application/json" \
    -d "$(jq -n --arg command "$1" '{command: $command, timeout: 600, stream: true}')" |
    jq -j --unbuffered '
      if .type == "stdout" or .type == "stderr" then .data
      elif .type == "exit" then (if .exit_code == 0 then empty else "exit code \(.exit_code)\n" | halt_error(1) end)
      else "\(.error.code): \(.error.message)\n" | halt_error(1) end'
}

echo "== Create a sandbox from the $TEMPLATE template"
# Images take memory and disk, so use the default size (2 vCPUs, 4 GiB) or a larger one.
body=$(jq -n --arg template "$TEMPLATE" '{template: $template, size: "default", internet: true, timeout: 900, metadata: {example: "docker"}}')
sandbox=$(api "$API/sandboxes" -H "Content-Type: application/json" -d "$body") || { echo "$sandbox" >&2; exit 1; }
SANDBOX=$(jq -r .id <<<"$sandbox")
trap 'echo "== Delete the sandbox"; api -X DELETE "$API/sandboxes/$SANDBOX" | jq -c "{id, status, end_reason}"' EXIT
while [ "$(jq -r .status <<<"$sandbox")" = pending ]; do sleep 1; sandbox=$(api "$API/sandboxes/$SANDBOX"); done
jq -c '{id, status, template, vcpus, memory_mib}' <<<"$sandbox"

if [ "$TEMPLATE" = ubuntu ]; then
  run "docker version --format 'Docker {{.Server.Version}} runs'"
  run "docker run --rm hello-world"
else
  # The base template has no Docker. Install it, then start its daemon. The daemon keeps running after its
  # command ends, so the later commands can use it.
  run "apt-get update && apt-get install -y docker.io"
  run "setsid dockerd --iptables=false --bridge=none >/var/log/dockerd.log 2>&1 < /dev/null &"
  run "for i in \$(seq 30); do docker version --format 'Docker {{.Server.Version}} runs' 2>/dev/null && exit 0; sleep 1; done; exit 1"
  # These containers have no bridge network: use --network host for internet access, or --network none.
  run "docker run --rm --network none hello-world"
fi
