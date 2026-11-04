# Sandboxes quick start — TypeScript

Create a sandbox, run a command in it, write and read a file, list the folder, and delete the sandbox.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
node quickstart.ts
```

Needs Node.js 22.18 or later, which runs a TypeScript file as it is. There is no package to install, and
`package.json` only names the Node version and the `npm start` alias.

## What it shows

- `POST /sandboxes` with `{"size": "small", "timeout": 300}`, and the wait while the status is `pending`.
- `POST /sandboxes/{id}/exec` with a string command, which runs in `bash -lc`, and with an argument vector.
- `PUT` and `GET` on `/sandboxes/{id}/files/content`, and `GET /sandboxes/{id}/files`.
- A `finally` block that deletes the sandbox, also after an error.

The script uses `fetch` only, so you can copy its `api()` helper into any runtime that has `fetch`.
