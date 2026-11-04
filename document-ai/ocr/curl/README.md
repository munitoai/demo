# OCR — curl

Read a PDF or an image into Markdown.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
./ocr.sh                                      # a sample receipt, by URL
./ocr.sh https://example.com/invoice.pdf      # any public URL
./ocr.sh ../data/receipt.png                  # a file on your machine, sent as base64
MUNITO_OCR_MODEL=munito/ocr-fast ./ocr.sh     # the text layer of a PDF only
```

Needs curl and [jq](https://jqlang.org/download/). `node ../data/fetch.mjs` downloads the sample documents.

The script writes the Markdown to standard output and its own messages to standard error, so
`./ocr.sh invoice.pdf > invoice.md` keeps the Markdown alone.

## What it shows

- `POST /inference/v1/ocr` with a document as a URL, and with a document as base64.
- The answer: one entry in `pages` for each page, with the Markdown of the page in `markdown`.
- `202` for a long document: the script reads `request_id` and polls `GET /inference/v1/ocr/{request_id}` until
  the status is no longer `running`. The answer also holds a `location`, which is the same route.
- `usage`, with the billed pages, the cost and `inference_region`, the region that read the pages.

## Models

| Model | How it reads a page |
| --- | --- |
| `munito/ocr-auto` | The default: the text layer of a text page, an OCR model for a scan |
| `munito/ocr-fast` | The text layer of a PDF only. A scan gives empty text and costs nothing |
| `lightonai/lightonocr-3-4b` | An OCR model for each page, with headings and HTML tables |

Set `MUNITO_BASE_URL` to `https://api.eu.munito.ai/inference/v1` to keep the work in the EU. See
[Document AI](https://docs.munito.ai/document-ai).
