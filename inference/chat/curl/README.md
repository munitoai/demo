# Chat — curl

Send one question to an open model, read the answer, then read the same answer as a stream.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
./chat.sh
./chat.sh "Why is EU data residency useful?"
MUNITO_MODEL=google/gemma-4-12b ./chat.sh
```

Needs curl and [jq](https://jqlang.org/download/).

## What it shows

- `POST /inference/v1/chat/completions`, the OpenAI Chat Completions API.
- The token counts in `usage`, which is what Munito AI bills.
- `"stream": true`, which sends server-sent events. Each event holds one piece of the answer in
  `choices[0].delta.content`, and the last line is `data: [DONE]`.
- `GET /inference/v1/models`, which lists the models that your key can call.

The public chat models reason by default, so give the answer room: a small `max_tokens` can go to reasoning alone
and leave `content` empty. See [Reasoning models](https://docs.munito.ai/features/reasoning).

The same key and the same host serve the Anthropic Messages API at `https://api.munito.ai/inference/v1/messages`.
To keep the work in the EU, use `https://api.eu.munito.ai/inference/v1`.
