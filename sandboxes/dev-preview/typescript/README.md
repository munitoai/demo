# Dev preview — TypeScript

Run a web server in a sandbox, and open it in your browser.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
node preview.ts                 # keeps the sandbox for 15 minutes
node preview.ts --minutes 60
```

Needs Node.js 22.18 or later, which runs a TypeScript file as it is. There is no package to install.

The script writes a small Node server into the sandbox, starts it on port 8080, and prints the URLs. Press Ctrl-C to
delete the sandbox. The sandbox also stops by itself at its timeout.

## The three ways to reach a port

| Way | Who opens it | How |
| --- | --- | --- |
| The token of the sandbox | Your code | `GET /sandboxes/{id}/ports/8080` gives `url` and `token`. Send the token in the header `munito-sandbox-token`. |
| A signed URL | One browser | `POST /sandboxes/{id}/ports/8080/url` with `{"expires_in": 3600}`. The browser keeps its access for 24 hours. |
| A public port | Each person with the URL | `"public_ports": [8080]` in the create, or `PUT /sandboxes/{id}/ports/8080` with `{"public": true}`. |

This example opens the port in the create, so the printed URL works in any browser. Remove `public_ports` from the
create to keep the port private, and use the signed URL instead.

## What to change

- Replace the `SERVER` constant with your own app, or with a command that starts one, such as `npm run dev`.
- The server must listen on `0.0.0.0` or `127.0.0.1`. A connection stays open for hours, so WebSockets and
  server-sent events work.
- `GET /sandboxes/{id}/ports` lists the ports that a server listens on right now, each with its URL.

See [Sandbox ports and SSH](https://docs.munito.ai/sandboxes/ports-and-ssh) for SSH into the same sandbox.
