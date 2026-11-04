# Munito AI examples

Runnable examples of the Munito AI APIs: **Sandboxes** (Linux microVMs), **Inference** (open models on an
OpenAI- and Anthropic-compatible API) and **Document AI** (OCR). Each example is a folder you can copy.

```
sandboxes/      a Linux microVM for your code, your agents and your builds
inference/      open models, through the OpenAI and Anthropic APIs
document-ai/    PDFs and images into Markdown
demos/          the large demos, which are not quick starts
```

## Why the tree looks like this

**Use case first, language second.** A reader arrives with a problem, not with a language: "I need to run code a
model wrote", "I need the text of a PDF". So the first level is the problem, and the second level is the language.
Two folders under one use case hold the same program in two languages, so you read the one you know and compare
with the other.

**Every example stands alone.** One folder holds its own README with the exact command, its own dependency file,
and nothing that reaches outside itself. Copy the folder into your project and it runs. Nothing here is a library,
and no example imports another one.

**One key, from the environment.** Every example reads `MUNITO_API_KEY` from the environment, and no example holds
a key, a host of Munito's own, or a private address. Each one calls the public API only.

## Get a key

1. Open [API keys in the console](https://console.munito.ai/keys).
2. Create a key with the **Inference** permission. The console shows it one time only.
3. Put it in the environment:

```bash
export MUNITO_API_KEY="munitoai_..."
```

Sandboxes are in preview. To turn them on for your organization,
[talk to an engineer](https://munito.ai/contact).

| | Value |
| --- | --- |
| Inference and Document AI | `https://api.munito.ai/inference/v1` |
| Sandboxes | `https://api.munito.ai/sandboxes/v1` |
| Header | `Authorization: Bearer $MUNITO_API_KEY` |
| EU only | `https://api.eu.munito.ai/inference/v1` |
| Guide | [docs.munito.ai](https://docs.munito.ai) |

## The examples

Run each command inside the folder of the example.

### Sandboxes

A sandbox is a Linux microVM with its own kernel, disk and network. See
[docs.munito.ai/sandboxes](https://docs.munito.ai/sandboxes).

| Example | What it does | Run it |
| --- | --- | --- |
| [quickstart/curl](sandboxes/quickstart/curl) | Create a sandbox, run a command, write and read a file, delete it | `./quickstart.sh` |
| [quickstart/python](sandboxes/quickstart/python) | The same steps, with httpx | `uv run quickstart.py` |
| [quickstart/typescript](sandboxes/quickstart/typescript) | The same steps, with `fetch` | `node quickstart.ts` |
| [code-interpreter/python](sandboxes/code-interpreter/python) | A model writes a script, and a sandbox with no network runs it | `uv run interpreter.py "your question"` |
| [code-interpreter/typescript](sandboxes/code-interpreter/typescript) | The same, with the OpenAI client | `npm install && npm start "your question"` |
| [fan-out/python](sandboxes/fan-out/python) | Start 100 sandboxes at once, run a command in each, print the timings | `uv run fan_out.py` |
| [fan-out/typescript](sandboxes/fan-out/typescript) | The same measurement, with `fetch` | `node fan-out.ts` |
| [dev-preview/typescript](sandboxes/dev-preview/typescript) | Run a web server in a sandbox, and open it in a browser | `node preview.ts` |
| [docker/curl](sandboxes/docker/curl) | Run Docker in a sandbox, from the `ubuntu` or the `base` template | `./docker.sh` |

### Inference

| Example | What it does | Run it |
| --- | --- | --- |
| [chat/curl](inference/chat/curl) | One answer, the same answer as a stream, and the model list | `./chat.sh` |
| [chat/python](inference/chat/python) | The same, with the OpenAI client | `uv run chat.py` |
| [chat/typescript](inference/chat/typescript) | The same, with the OpenAI client | `npm install && npm start` |

### Document AI

| Example | What it does | Run it |
| --- | --- | --- |
| [ocr/curl](document-ai/ocr/curl) | A PDF or an image into Markdown, by URL or as base64 | `./ocr.sh` |
| [ocr/python](document-ai/ocr/python) | The same, with page selection, tables and invoice fields | `uv run ocr.py` |
| [ocr/typescript](document-ai/ocr/typescript) | A React app that reads a document, with the key in its dev server | `npm ci && npm run dev` |
| [ocr/data](document-ai/ocr/data) | Four public sample documents for the three examples above | `node fetch.mjs` |

### Demos

| Demo | What it does |
| --- | --- |
| [place](demos/place) | 32,752 sandboxes paint one picture, one sandbox for each pixel, in [TypeScript](demos/place/typescript) and in [Python](demos/place/python) |

## What each language needs

- **The shell examples** need curl and [jq](https://jqlang.org/download/).
- **The Python examples** need [uv](https://docs.astral.sh/uv/). Each script declares its packages in its own
  header (PEP 723), so `uv run <script>.py` installs them in a temporary environment. There is no shared
  environment and no `requirements.txt`.
- **The TypeScript examples** need Node.js 22.18 or later, which runs a TypeScript file as it is. An example that
  needs a package says so and holds its own `package.json`.

Every example gives its sandboxes a short `timeout`, so a sandbox stops by itself when a script stops early, and
every example deletes its sandboxes at the end.

## Costs

An example that runs a sandbox or calls a model spends credits. The quick starts use the smallest size and run for
seconds. The [place demo](demos/place) can start tens of thousands of sandboxes, so read its README before you
raise its pixel count. See [sandbox pricing](https://docs.munito.ai/sandboxes/pricing),
[inference pricing](https://docs.munito.ai/pricing) and
[Document AI pricing](https://docs.munito.ai/document-ai/pricing).

## License

The code is under the [MIT license](LICENSE). The pictures of the place demo show the marks of Munito and of
Terse. The license does not cover these marks.
