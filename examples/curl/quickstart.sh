#!/usr/bin/env bash
# Sandboxes quick start with curl: create a sandbox, run a command, write and read a file, delete the sandbox.
# Needs curl, jq, and a Munito API key in MUNITO_API_KEY.
set -euo pipefail

API="https://api.munito.ai/sandboxes/v1"
: "${MUNITO_API_KEY:?Set MUNITO_API_KEY to your Munito API key.}"
command -v jq >/dev/null || { echo "Install jq first: https://jqlang.org/download/" >&2; exit 1; }

# curl with the key. On an HTTP error, --fail-with-body prints the problem that the API returns, and curl fails.
api() { curl -sS --fail-with-body -H "Authorization: Bearer $MUNITO_API_KEY" "$@"; }

echo "== Create a sandbox"
sandbox=$(api "$API/sandboxes" -H "Content-Type: application/json" \
  -d '{"size": "small", "timeout": 300, "metadata": {"example": "curl-quickstart"}}') || { echo "$sandbox" >&2; exit 1; }
SANDBOX=$(jq -r .id <<<"$sandbox")
# Delete the sandbox when the script ends, also after an error. The timeout stops it in any case.
trap 'echo "== Delete the sandbox"; api -X DELETE "$API/sandboxes/$SANDBOX" | jq -c "{id, status, end_reason}"' EXIT
# The answer is "pending" when the start takes longer. Wait until the sandbox runs.
while [ "$(jq -r .status <<<"$sandbox")" = pending ]; do sleep 1; sandbox=$(api "$API/sandboxes/$SANDBOX"); done
jq -c '{id, status, template, vcpus, memory_mib, expires_at}' <<<"$sandbox"

echo "== Run a command"
api "$API/sandboxes/$SANDBOX/exec" -H "Content-Type: application/json" \
  -d '{"command": "python3 -c \"import platform; print(platform.platform())\""}' | jq -c .

echo "== Write a file"
api -X PUT "$API/sandboxes/$SANDBOX/files/content?path=/workspace/hello.py" \
  -H "Content-Type: application/octet-stream" --data-binary 'print("Hello from the sandbox")' | jq -c .

echo "== Read the file"
api "$API/sandboxes/$SANDBOX/files/content?path=/workspace/hello.py"
echo

echo "== Run the file"
api "$API/sandboxes/$SANDBOX/exec" -H "Content-Type: application/json" \
  -d '{"command": ["python3", "hello.py"]}' | jq -j .stdout

echo "== List /workspace"
api "$API/sandboxes/$SANDBOX/files?path=/workspace" | jq -r '.data[] | "\(.type)  \(.size) bytes  \(.path)"'
