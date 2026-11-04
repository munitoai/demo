# Fan-out — TypeScript

Start many sandboxes at once, run one command in each, print the timings, and delete the sandboxes.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
node fan-out.ts                               # 100 sandboxes
node fan-out.ts --count 20 --command nproc
```

Needs Node.js 22.18 or later, which runs a TypeScript file as it is. There is no package to install.

## What it reports

Three phases, each with the number of sandboxes that answered, the wall time, and the spread. This is a real run of
`node fan-out.ts --count 8` on 2026-11-04:

```
Starting 8 sandboxes of size small at once
create      8 of 8     ok in   0.12 s   p50 0.09 s  p90 0.11 s  max 0.11 s
command     8 of 8     ok in   0.29 s   p50 0.08 s  p90 0.28 s  max 0.28 s
            8 different outputs, such as: 655d0105-27c0-4f67-8db4-3c96e6c1056b
delete      8 of 8     ok in   0.15 s   p50 0.11 s  p90 0.15 s  max 0.15 s
```

The default command prints the boot id of the sandbox's kernel. Each sandbox is a separate microVM, so each boot id
is different, and the script counts the different outputs.

## Limits

An organization in the preview runs a limited number of sandboxes at once. A create above that limit answers `429
sandbox_limit_reached`, and the script names it in the failures. Use a smaller `--count`, or ask for a higher limit.

A create that gets `503 no_capacity` waits as long as the `retry-after` header asks, and then tries again, up to
five times. The `finally` block deletes every sandbox that started, also after an error.

The Python version of this example measures the same three phases, and it keeps one HTTP/2 connection for every
request.
