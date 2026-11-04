# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///
"""Read a PDF or an image into Markdown with the Munito AI OCR API.

    export MUNITO_API_KEY="munitoai_..."
    uv run ocr.py                                 # a sample receipt, by URL
    uv run ocr.py https://example.com/invoice.pdf # any public URL
    uv run ocr.py ../data/mistral7b.pdf           # a file on your machine, sent as base64
    uv run ocr.py ../data/mistral7b.pdf --pages 0 1 2
    uv run ocr.py scan.pdf --tables               # each table also as its own entry
    uv run ocr.py invoice.pdf --extract           # the fields of the invoice as JSON

The answer holds one entry in `pages` for each page, with the Markdown of the page in `markdown`. A long document
answers 202, and the script then polls until the result is ready. Set MUNITO_OCR_MODEL to another OCR model:

    munito/ocr-auto             the default: the text layer of a text page, an OCR model for a scan
    munito/ocr-fast             the text layer of a PDF only. A scan gives empty text and costs nothing
    lightonai/lightonocr-3-4b   an OCR model for each page, with headings and HTML tables
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

import httpx

# Use https://api.eu.munito.ai/inference/v1 to keep the work in the EU.
API = os.environ.get("MUNITO_BASE_URL", "https://api.munito.ai/inference/v1")
MODEL = os.environ.get("MUNITO_OCR_MODEL", "munito/ocr-auto")
SAMPLE = "https://raw.githubusercontent.com/mistralai/cookbook/refs/heads/main/mistral/ocr/receipt.png"
# The fields that --extract asks the API to read out of an invoice.
INVOICE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "invoice",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "seller": {"type": "string"},
                "invoice_number": {"type": "string"},
                "date": {"type": "string"},
                "currency": {"type": "string"},
                "total": {"type": "number"},
            },
            "required": ["seller", "total"],
        },
    },
}


def document_of(source: str) -> dict[str, str]:
    """The `document` of the request: a URL as a URL, and a file on your machine as base64."""
    if source.startswith(("http://", "https://")):
        return {"type": "url", "url": source}
    path = Path(source)
    if not path.is_file():
        sys.exit(f"No such file: {source}")
    return {"type": "base64", "data": base64.b64encode(path.read_bytes()).decode(), "filename": path.name}


def check(response: httpx.Response) -> httpx.Response:
    """The response, or exit with the problem that the API returned."""
    if response.is_error:
        sys.exit(f"{response.request.method} {response.request.url.path}: HTTP {response.status_code} {response.text}")
    return response


def wait(api: httpx.Client, request_id: str) -> dict:
    """The result of a long document. The API reads it page by page, so poll until it stops running."""
    print(f"The document is long. Poll {request_id}", file=sys.stderr)
    for _ in range(300):
        time.sleep(2)
        body = check(api.get(f"/ocr/{request_id}")).json()
        if body.get("status") != "running":
            return body
        print(f"\r   {body.get('completed', 0)} of {body.get('total', '?')} pages", end="", file=sys.stderr)
    sys.exit("The document took too long.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("document", nargs="?", default=SAMPLE, help="a URL, or a file on your machine")
    parser.add_argument("--pages", type=int, nargs="+", help="the pages to read, from 0. The default is each page")
    parser.add_argument("--tables", action="store_true", help="also give each table as its own entry")
    parser.add_argument("--extract", action="store_true", help="also read the fields of an invoice as JSON")
    args = parser.parse_args()

    key = os.environ.get("MUNITO_API_KEY")
    if not key:
        sys.exit("Set MUNITO_API_KEY to your Munito API key.")

    body: dict = {"document": document_of(args.document), "model": MODEL, "confidence_scores": True}
    if args.pages:
        body["pages"] = args.pages
    if args.tables:
        # The page Markdown stays whole. Each table also comes back in pages[].tables.
        body["tables"] = {"mode": "extracted", "format": "markdown"}
    if args.extract:
        body["document_annotation_format"] = INVOICE_SCHEMA
        body["document_annotation_prompt"] = "Read the fields of this invoice. Leave a field out when it is absent."

    print(f"Read {args.document}", file=sys.stderr)
    headers = {"Authorization": f"Bearer {key}"}
    # The whole document can take minutes, so give the client time.
    with httpx.Client(base_url=API, headers=headers, timeout=600) as api:
        answer = check(api.post("/ocr", json=body))
        result = wait(api, answer.json()["request_id"]) if answer.status_code == 202 else answer.json()
        if result.get("status") not in (None, "completed"):
            sys.exit(f"The request ended as {result['status']}.")

    for page in result["pages"]:
        print(f"\n<!-- page {page['index']} -->")
        print(page["markdown"])
        for table in page.get("tables") or []:
            print(f"\n<!-- page {page['index']}, {table['id']} -->\n{table['content']}")
    if result.get("document_annotation"):
        print(f"\n<!-- fields -->\n{json.dumps(json.loads(result['document_annotation']), indent=2)}")

    usage = result["usage"]
    # The Markdown goes to standard output and this line to standard error. Flush first, so that a terminal that
    # shows both keeps them in order.
    sys.stdout.flush()
    print(
        f"\n[{result['model']}: {usage['pages_processed']} pages, {usage['pages_failed']} failed,"
        f" {usage['cost_usd']} USD, read in {usage['inference_region']}]",
        file=sys.stderr,
    )
    return 1 if usage["pages_failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
