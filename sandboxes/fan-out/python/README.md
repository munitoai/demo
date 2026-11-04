# Fan-out — Python

Start many sandboxes at once, run one command in each, print the timings, and delete the sandboxes.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
uv run fan_out.py                             # 100 sandboxes
uv run fan_out.py -n 20 --command "nproc"
```

Needs [uv](https://docs.astral.sh/uv/). The script declares `httpx[http2]` in its header (PEP 723).

## What it reports

Three phases, each with the number of sandboxes that answered, the wall time, and the spread. This is a real run of
`uv run fan_out.py -n 8` on 2026-11-04:

```
Starting 8 sandboxes of size small at once
create      8 of 8     ok in   0.14 s   p50 0.09 s  p90 0.11 s  max 0.13 s
command     8 of 8     ok in   0.11 s   p50 0.08 s  p90 0.11 s  max 0.11 s
            8 different outputs, such as: a1412914-1e4d-4f0f-a25c-e8ca5d22a231
delete      8 of 8     ok in   0.12 s   p50 0.09 s  p90 0.11 s  max 0.12 s
```

The default command prints the boot id of the sandbox's kernel. Each sandbox is a separate microVM, so each boot id
is different, and the script counts the different outputs.

## Limits

An organization in the preview runs a limited number of sandboxes at once. A create above that limit answers `429
sandbox_limit_reached`, and the script names it in the failures. Use a smaller `-n`, or ask for a higher limit.

A create that gets `503 no_capacity` waits as long as the `retry-after` header asks, and then tries again, up to
five times. Ctrl-C starts no new sandbox and deletes the ones that run.
