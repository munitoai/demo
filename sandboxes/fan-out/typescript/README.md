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
sandbox_limit_reached`, and the script names it in the failures. Use a smaller `--count`, or ask for a higher limit.

A create that gets `503 no_capacity` waits as long as the `retry-after` header asks, and then tries again, up to
five times. The `finally` block deletes every sandbox that started, also after an error.

The Python version of this example measures the same three phases, and it keeps one HTTP/2 connection for every
request.
