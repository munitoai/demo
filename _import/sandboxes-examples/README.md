# Munito Sandboxes examples

Munito Sandboxes: cloud computers on demand. Each sandbox is a microVM with its own kernel, disk and network, for
your agents, code execution, CI, and much more. The sandboxes run on bare-metal hosts in France. Your code creates a
sandbox with one API call, runs commands in it, reads and writes its files, and deletes it.

This repository holds runnable examples of the Sandboxes API. It also holds the demo where 32,752 sandboxes paint
one picture.

## Get access and a key

Sandboxes are in preview. To turn them on for your organization, [talk to an engineer](https://munito.ai/contact).

1. Open [API keys in the console](https://console.munito.ai/keys).
2. Create a key with the **Inference** permission.
3. Put the key in the environment variable `MUNITO_API_KEY`. Each example reads the key from there.

| | Value |
| --- | --- |
| Base URL | `https://api.munito.ai/sandboxes/v1` |
| Header | `Authorization: Bearer $MUNITO_API_KEY` |
| Guide | [docs.munito.ai/sandboxes](https://docs.munito.ai/sandboxes) |
| Prices | [Sandbox pricing](https://docs.munito.ai/sandboxes/pricing) |
| Cloud agents | [Claude Code, Codex and OpenCode in a sandbox](https://docs.munito.ai/sandboxes/cloud-agents) |

## Quick start with curl

The commands need curl and [jq](https://jqlang.org/download/).

```bash
export MUNITO_API_KEY="munitoai_..."
API=https://api.munito.ai/sandboxes/v1
AUTH="Authorization: Bearer $MUNITO_API_KEY"

# Create a sandbox. It stops by itself after 300 seconds.
SANDBOX=$(curl -sS --fail-with-body "$API/sandboxes" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"size": "small", "timeout": 300}' | jq -r .id)

# Run a command.
curl -sS --fail-with-body "$API/sandboxes/$SANDBOX/exec" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"command": "python3 -c \"print(6 * 7)\""}'

# Write a file, then read it.
curl -sS --fail-with-body -X PUT "$API/sandboxes/$SANDBOX/files/content?path=/workspace/hello.txt" \
  -H "$AUTH" -H "Content-Type: application/octet-stream" --data-binary "Hello from the sandbox"
curl -sS --fail-with-body "$API/sandboxes/$SANDBOX/files/content?path=/workspace/hello.txt" -H "$AUTH"

# Delete the sandbox.
curl -sS --fail-with-body -X DELETE "$API/sandboxes/$SANDBOX" -H "$AUTH"
```

## Examples

Run each command from the root of this repository.

| Example | What it does | Run it |
| --- | --- | --- |
| [curl](examples/curl/quickstart.sh) | Creates a sandbox, runs a command, writes and reads a file, and deletes the sandbox. | `./examples/curl/quickstart.sh` |
| [Python](examples/python/quickstart.py) | The same steps in Python, with httpx. | `uv run examples/python/quickstart.py` |
| [Fan-out](examples/python/fan_out.py) | Starts 100 sandboxes at once, runs a command in each, prints the timings, and deletes the sandboxes. | `uv run examples/python/fan_out.py` |
| [TypeScript](examples/typescript/quickstart.ts) | The same steps as the curl example, with `fetch`. | `node examples/typescript/quickstart.ts` |
| [Docker](examples/docker/docker.sh) | Runs Docker in a sandbox, from the `ubuntu` template or the `base` template. | `./examples/docker/docker.sh` |
| [Code interpreter](examples/code-interpreter/interpreter.py) | A model writes a Python script for a question, and a sandbox with no network runs it. | `uv run examples/code-interpreter/interpreter.py "your question"` |
| [Terse place](demos/terse-place) | One sandbox for each pixel paints a picture on [Terse](https://useterse.ai) durable actors. | See its [README](demos/terse-place/README.md). |

What each example needs:

- The shell examples need curl and [jq](https://jqlang.org/download/).
- The Python examples need [uv](https://docs.astral.sh/uv/). Each script declares its packages (PEP 723), and
  `uv run` installs them in a temporary environment.
- The TypeScript example needs Node.js 22.18 or later, which runs TypeScript files. It needs no package.

Each example gives its sandboxes a `timeout` of 15 minutes or less, so that a sandbox stops by itself when a script
stops early. Each example deletes its sandboxes at the end.

## API operations

The API has these operations. The [guide](https://docs.munito.ai/sandboxes) gives the fields, the sizes, the limits and
the lifecycle of a sandbox.

| Operation | Request |
| --- | --- |
| Create a sandbox | `POST /sandboxes` |
| List sandboxes | `GET /sandboxes` |
| Get a sandbox | `GET /sandboxes/{sandbox_id}` |
| Delete a sandbox | `DELETE /sandboxes/{sandbox_id}` |
| Set the timeout | `POST /sandboxes/{sandbox_id}/timeout` |
| Pause a sandbox | `POST /sandboxes/{sandbox_id}/pause` |
| Resume a sandbox | `POST /sandboxes/{sandbox_id}/resume` |
| Fork a sandbox | `POST /sandboxes/{sandbox_id}/fork` |
| Run a command | `POST /sandboxes/{sandbox_id}/exec` |
| List files | `GET /sandboxes/{sandbox_id}/files` |
| Read a file | `GET /sandboxes/{sandbox_id}/files/content` |
| Write a file | `PUT /sandboxes/{sandbox_id}/files/content` |
| Delete a file | `DELETE /sandboxes/{sandbox_id}/files` |
| Get the URL of a port | `GET /sandboxes/{sandbox_id}/ports/{port}` |
| Make a port public or private | `PUT /sandboxes/{sandbox_id}/ports/{port}` |
| Sign a URL for a port | `POST /sandboxes/{sandbox_id}/ports/{port}/url` |
| Get the SSH command | `GET /sandboxes/{sandbox_id}/ssh` |
| Set the SSH keys | `PUT /sandboxes/{sandbox_id}/ssh` |

## License

The code is under the [MIT license](LICENSE). The pictures of the Terse demo show the marks of Munito and Terse. The
license does not cover these marks.
