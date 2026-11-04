# OCR — Python

Read a PDF or an image into Markdown, with page selection, table extraction and field extraction.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
uv run ocr.py                                  # a sample receipt, by URL
uv run ocr.py https://example.com/invoice.pdf  # any public URL
uv run ocr.py ../data/mistral7b.pdf            # a file on your machine, sent as base64
uv run ocr.py ../data/mistral7b.pdf --pages 0 1 2
uv run ocr.py ../data/receipt.png --tables     # each table also as its own entry
uv run ocr.py invoice.pdf --extract            # the fields of the invoice as JSON
```

Needs [uv](https://docs.astral.sh/uv/). The script declares `httpx` in its header (PEP 723).
`node ../data/fetch.mjs` downloads the sample documents.

The script writes the Markdown to standard output and its own messages to standard error.

## What it shows

- `POST /inference/v1/ocr` with a document as a URL, and with a document as base64.
- The answer: one entry in `pages` for each page, with the Markdown of the page in `markdown`.
- `202` for a long document: the script polls `GET /inference/v1/ocr/{request_id}` and prints the page count while
  it waits.
- `pages`, which reads a few pages of a long document. The pages count from 0.
- `tables: {"mode": "extracted"}`, which also gives each table in `pages[].tables`. The page Markdown stays whole.
- `document_annotation_format` with a JSON schema, which reads the fields of an invoice. The answer holds them in
  `document_annotation`, a JSON string that matches the schema. The page price includes this step.
- `usage`, with the billed pages, the cost and `inference_region`, the region that read the pages.

## Models

| Model | How it reads a page |
| --- | --- |
| `munito/ocr-auto` | The default: the text layer of a text page, an OCR model for a scan |
| `munito/ocr-fast` | The text layer of a PDF only. A scan gives empty text and costs nothing |
| `lightonai/lightonocr-3-4b` | An OCR model for each page, with headings and HTML tables |

Set `MUNITO_OCR_MODEL` for the model, and `MUNITO_BASE_URL` to `https://api.eu.munito.ai/inference/v1` to keep the
work in the EU. See [Document AI](https://docs.munito.ai/document-ai) and
[Invoice extraction](https://docs.munito.ai/recipes/invoice-extraction).
