#!/usr/bin/env bash
# Chat with an open model on the OpenAI-compatible API of Munito AI.
# Needs curl, jq, and a Munito API key in MUNITO_API_KEY.
#
#   ./chat.sh                            the default question
#   ./chat.sh "Why is EU data residency useful?"
#   MUNITO_MODEL=google/gemma-4-12b ./chat.sh
set -euo pipefail

API="https://api.munito.ai/inference/v1"
MODEL=${MUNITO_MODEL:-qwen/qwen3.8-27b}
QUESTION=${1:-"Say hello in one sentence."}
: "${MUNITO_API_KEY:?Set MUNITO_API_KEY to your Munito API key.}"
command -v jq >/dev/null || { echo "Install jq first: https://jqlang.org/download/" >&2; exit 1; }

# curl with the key. On an HTTP error, --fail-with-body prints the problem that the API returns, and curl fails.
api() { curl -sS --fail-with-body -H "Authorization: Bearer $MUNITO_API_KEY" -H "Content-Type: application/json" "$@"; }

echo "== One answer, with the token counts"
# The public chat models reason by default, so give the answer room: a small max_tokens can go to reasoning alone.
body=$(jq -n --arg model "$MODEL" --arg question "$QUESTION" \
  '{model: $model, messages: [{role: "user", content: $question}], max_tokens: 1024}')
api "$API/chat/completions" -d "$body" |
  jq -r '"\(.choices[0].message.content)\n\n[\(.model): \(.usage.prompt_tokens) prompt + \(.usage.completion_tokens) completion tokens]"'

echo
echo "== The same answer as a stream"
# "stream": true sends server-sent events. Each event holds one piece of the answer in choices[0].delta.content.
stream=$(jq -n --arg model "$MODEL" --arg question "$QUESTION" \
  '{model: $model, messages: [{role: "user", content: $question}], max_tokens: 1024, stream: true}')
api -N "$API/chat/completions" -d "$stream" |
  while IFS= read -r line; do
    [ "${line#data: }" = "$line" ] && continue
    data=${line#data: }
    [ "$data" = "[DONE]" ] && break
    printf '%s' "$(jq -j '.choices[0].delta.content // ""' <<<"$data")"
  done
echo

echo
echo "== Which models you can call"
api "$API/models" | jq -r '.data[].id'
