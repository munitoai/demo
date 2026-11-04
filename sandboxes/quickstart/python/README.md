# Sandboxes quick start — Python

Create a sandbox, run a command in it, write and read a file, list the folder, and delete the sandbox.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
uv run quickstart.py
```

Needs [uv](https://docs.astral.sh/uv/). The script declares `httpx` in its header (PEP 723), so `uv run` installs
it in a temporary environment. There is nothing else to install.

## What it shows

- `POST /sandboxes` with `{"size": "small", "timeout": 300}`, and the wait while the status is `pending`.
- `POST /sandboxes/{id}/exec` with a string command, which runs in `bash -lc`, and with an argument vector.
- `PUT` and `GET` on `/sandboxes/{id}/files/content`, and `GET /sandboxes/{id}/files`.
- A `finally` block that deletes the sandbox, also after an error.

The `timeout` of 300 seconds stops the sandbox by itself when the script stops early.
