# Sandboxes quick start — curl

Create a sandbox, run a command in it, write and read a file, list the folder, and delete the sandbox.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
./quickstart.sh
```

Needs curl and [jq](https://jqlang.org/download/).

## What it shows

- `POST /sandboxes` with `{"size": "small", "timeout": 300}`, and the wait while the status is `pending`.
- `POST /sandboxes/{id}/exec` with a string command, which runs in `bash -lc`, and with an argument vector.
- `PUT` and `GET` on `/sandboxes/{id}/files/content?path=...`, and `GET /sandboxes/{id}/files?path=...`.
- A `trap` that deletes the sandbox when the script ends, also after an error.

`--fail-with-body` prints the problem that the API returns and makes curl fail, so an error never passes unseen.
