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

Three phases, each with the number of sandboxes that answered, the wall time, and the spread:

```
create     100 of 100   ok in   8.41 s   p50 1.92 s  p90 3.10 s  max 4.77 s
command    100 of 100   ok in   1.63 s   p50 0.41 s  p90 0.78 s  max 1.02 s
delete     100 of 100   ok in   2.05 s   p50 0.33 s  p90 0.61 s  max 0.94 s
```

The default command prints the boot id of the sandbox's kernel. Each sandbox is a separate microVM, so each boot id
is different, and the script counts the different outputs.

## Limits

An organization in the preview runs a limited number of sandboxes at once. A create above that limit answers `429
sandbox_limit_reached`, and the script names it in the failures. Use a smaller `-n`, or ask for a higher limit.

A create that gets `503 no_capacity` waits as long as the `retry-after` header asks, and then tries again, up to
five times. Ctrl-C starts no new sandbox and deletes the ones that run.
