#!/usr/bin/env bash
# Read a PDF or an image into Markdown with the Munito AI OCR API.
# Needs curl, jq, and a Munito API key in MUNITO_API_KEY.
#
#   ./ocr.sh                                      a sample receipt, by URL
#   ./ocr.sh https://example.com/invoice.pdf       any public URL
#   ./ocr.sh ../data/mistral7b.pdf                 a file on your machine, sent as base64
#   MUNITO_OCR_MODEL=munito/ocr-fast ./ocr.sh      the text layer of a PDF only
#
# The answer holds one entry in "pages" for each page, with the Markdown of the page in "markdown".
# A long document answers 202, and the script then polls until the result is ready.
set -euo pipefail

# Use https://api.eu.munito.ai/inference/v1 to keep the work in the EU.
API=${MUNITO_BASE_URL:-https://api.munito.ai/inference/v1}
MODEL=${MUNITO_OCR_MODEL:-munito/ocr-auto}
SAMPLE="https://raw.githubusercontent.com/mistralai/cookbook/refs/heads/main/mistral/ocr/receipt.png"
DOCUMENT=${1:-$SAMPLE}
: "${MUNITO_API_KEY:?Set MUNITO_API_KEY to your Munito API key.}"
command -v jq >/dev/null || { echo "Install jq first: https://jqlang.org/download/" >&2; exit 1; }

api() { curl -sS -H "Authorization: Bearer $MUNITO_API_KEY" -H "Content-Type: application/json" "$@"; }

# A URL goes to the API as a URL. A file on your machine goes as base64.
case "$DOCUMENT" in
  http://*|https://*)
    echo "== Read $DOCUMENT" >&2
    document=$(jq -n --arg url "$DOCUMENT" '{type: "url", url: $url}')
    ;;
  *)
    [ -f "$DOCUMENT" ] || { echo "No such file: $DOCUMENT" >&2; exit 2; }
    echo "== Read $DOCUMENT ($(wc -c <"$DOCUMENT" | tr -d ' ') bytes)" >&2
    document=$(jq -n --arg data "$(base64 <"$DOCUMENT" | tr -d '\n')" --arg name "$(basename "$DOCUMENT")" \
      '{type: "base64", data: $data, filename: $name}')
    ;;
esac

body=$(jq -n --argjson document "$document" --arg model "$MODEL" \
  '{document: $document, model: $model, confidence_scores: true}')
# The whole document can take minutes, so give curl time, and keep the HTTP status with the body.
answer=$(api --max-time 600 -w '\n%{http_code}' "$API/ocr" -d "$body")
status=${answer##*$'\n'}
body=${answer%$'\n'*}

# 202 means the document is long: poll the result until its status is no longer "running".
if [ "$status" = 202 ]; then
  request_id=$(jq -r .request_id <<<"$body")
  echo "== The document is long. Poll $request_id" >&2
  for _ in $(seq 300); do
    sleep 2
    body=$(api --max-time 60 "$API/ocr/$request_id")
    state=$(jq -r '.status // "completed"' <<<"$body")
    [ "$state" = running ] || break
    printf '\r   %s of %s pages' "$(jq -r '.completed // 0' <<<"$body")" "$(jq -r '.total // "?"' <<<"$body")" >&2
  done
  echo >&2
  [ "$(jq -r '.status' <<<"$body")" = completed ] || { echo "$body" >&2; exit 1; }
elif [ "$status" != 200 ]; then
  echo "HTTP $status" >&2
  echo "$body" >&2
  exit 1
fi

# The Markdown of each page, and then the billed pages and the region that read them.
jq -r '.pages[] | "\n<!-- page \(.index) -->\n\(.markdown)"' <<<"$body"
usage='"\n[\(.model): \(.usage.pages_processed) pages, \(.usage.pages_failed) failed, '
usage+='\(.usage.cost_usd) USD, read in \(.usage.inference_region)]"'
jq -r "$usage" <<<"$body" >&2
