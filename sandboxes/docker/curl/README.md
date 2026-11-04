# Docker in a sandbox — curl

Run Docker inside a sandbox. A sandbox is a microVM with its own kernel, so it runs a container engine.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
./docker.sh          # the ubuntu template: Docker runs when the sandbox starts
./docker.sh base     # the base template: install Docker and start its daemon first
```

Needs curl and [jq](https://jqlang.org/download/).

## What it shows

- The `ubuntu` template, which already has Docker, and the `base` template, which does not.
- `"stream": true` on `POST /sandboxes/{id}/exec`: the API sends NDJSON, so you read the output while the command
  runs. The script prints each `stdout` and `stderr` event, and fails on a non-zero `exit` event.
- A daemon that keeps running after its command ends, so the later commands use it.

Images take memory and disk, so the script asks for the `default` size, which is 2 vCPUs and 4 GiB.

On the `base` template the containers have no bridge network. Use `--network host` for internet access, or
`--network none`. See [Sandbox templates](https://docs.munito.ai/sandboxes/templates).
