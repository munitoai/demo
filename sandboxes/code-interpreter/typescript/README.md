# Code interpreter — TypeScript

A model writes a Python script for your question, and a sandbox with no network runs it. When a script fails, the
model reads the error and writes a new one. The model writes at most three scripts.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
npm install
npm start "How many prime numbers are there below one million?"
```

Needs Node.js 22.18 or later, which runs a TypeScript file as it is. `npm install` adds the OpenAI client, which
reaches Munito AI with one change: the base URL.

## What it shows

- One key for two APIs: the model answers on `https://api.munito.ai/inference/v1`, and the same key starts the
  sandbox on `https://api.munito.ai/sandboxes/v1`.
- `"internet": false` in the create, because nobody reviews the code that a model writes.
- The error loop: the script sends `stderr` back to the model, and the model fixes its script.
- A `finally` block that deletes the sandbox, also after an error.

Set `MUNITO_MODEL` to another model. `GET /inference/v1/models` lists the models that your key can call.
