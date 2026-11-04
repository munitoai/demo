# Test documents

These four public documents use the URLs from the monorepo's Bruno OCR requests.
`sources.json` records each URL, Bruno request, source commit, and SHA-256 checksum.

Run `npm run data:fetch` to restore the files.
The script refuses a file whose checksum changes.

| File                              | Bruno test         |
| --------------------------------- | ------------------ |
| `receipt.png`                     | Receipt OCR        |
| `lithium_iron_cell_datasheet.pdf` | Datasheet OCR      |
| `patient-packet-completed.pdf`    | Patient form OCR   |
| `mistral7b.pdf`                   | Research paper OCR |

Git ignores the document binaries, as the monorepo does.
The app excludes this folder from its build and blocks access through the development server.
