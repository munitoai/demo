# Chat — TypeScript

Send one question to an open model, read the answer, then read the same answer as a stream.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
npm install
npm start
npm start "Why is EU data residency useful?"
MUNITO_MODEL=google/gemma-4-12b npm start
```

Needs Node.js 22.18 or later, which runs a TypeScript file as it is. `npm install` adds the OpenAI client.

## What it shows

- The OpenAI client against Munito AI. One change does it: `baseURL: "https://api.munito.ai/inference/v1"`.
- The token counts in `usage`, which is what Munito AI bills.
- `stream: true` with `stream_options: { include_usage: true }`, so the last event carries the token counts.
- `client.models.list()`, which lists the models that your key can call.

The public chat models reason by default, so give the answer room: a small `max_tokens` can go to reasoning alone
and leave the content empty. See [Reasoning models](https://docs.munito.ai/features/reasoning).

Set `MUNITO_BASE_URL` to `https://api.eu.munito.ai/inference/v1` to keep the work in the EU. The same key works
with the Anthropic client at `https://api.munito.ai/inference`, and with the Sandboxes API.
