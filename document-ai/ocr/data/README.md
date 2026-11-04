# Sample documents

Four public documents, for the OCR examples beside this folder. `sources.json` records each URL, its Bruno request
in the monorepo, the source commit, and the SHA-256 checksum of the file.

Download them:

```bash
node fetch.mjs
```

The script refuses a file whose checksum differs from `sources.json`. Git ignores the four files, so each clone
downloads them again.

| File                              | What it is         |
| --------------------------------- | ------------------ |
| `receipt.png`                     | A receipt          |
| `lithium_iron_cell_datasheet.pdf` | A product datasheet |
| `patient-packet-completed.pdf`    | A filled patient form |
| `mistral7b.pdf`                   | A research paper   |

Each OCR example takes a path, so point it at one of these files:

```bash
../curl/ocr.sh ../data/receipt.png
uv run ../python/ocr.py ../data/mistral7b.pdf --pages 0
```

The TypeScript app takes the file from a file field in the browser.
