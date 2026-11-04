# Place — Python

Munito sandboxes paint one picture, one sandbox for each pixel. Each sandbox is a microVM that runs a single
`curl` to a [Terse](https://useterse.ai) durable actor, and your browser watches the actor live over a WebSocket.

Read [the demo README](../README.md) first for what the demo is and what the preview limits are.

## How it works

- `src/actors.py`: the `Canvas` actor keeps the picture. Each `paint` call sets one pixel and goes to every viewer.
- `paint.py`: starts one Munito sandbox for each pixel. The sandbox runs one command, a `curl` to the actor, so it
  needs no package. Each sandbox ends by itself after `--lifetime` seconds.
- `viewer.html`: draws the canvas. `paint.py` serves it on port 8000, with a fresh WebSocket grant for each
  connection.

## Run it

You need [uv](https://docs.astral.sh/uv/), a Munito API key, and a place for the actor.

1. Install the packages:

   ```bash
   uv sync
   ```

2. Start the actor. The sandboxes must reach it from the internet.

   - **Terse cloud:** run `terse deploy`. Then set `DURABLE_ACTORS_CONTROL_PLANE_URL`,
     `DURABLE_ACTORS_PROJECT_ID` and `DURABLE_ACTORS_API_KEY` from your Terse project.
   - **Your machine:** run `uv run durable-actors dev`, and give it a public address, for example
     `cloudflared tunnel --url http://127.0.0.1:7100`. Set `DURABLE_ACTORS_CONTROL_PLANE_URL` to that address and
     `DURABLE_ACTORS_PROJECT_ID=local`.

3. Paint, then open `http://127.0.0.1:8000`:

   ```bash
   MUNITO_API_KEY=... uv run python paint.py pictures/munito-boxes-terse-actor.png
   ```

## Options

| Option | Default | Use |
| --- | --- | --- |
| `--scale` | `0.25` | `0.25` paints 92 × 22 = 2,024 pixels. `1` paints all 368 × 89 = 32,752 |
| `--canvas` | `munito-boxes` | The id of the canvas actor. Use a new id for an empty canvas |
| `--workers` | `64` | The sandbox creates in flight |
| `--lifetime` | `120` | The seconds before each sandbox ends by itself |
| `--port` | `8000` | The port of the viewer |
| `--watch` | | Only serve the viewer of a canvas that is already painted |

A test run at `--scale 0.25` painted its 2,024 pixels in 32 s with one local Terse runtime. Any PNG works: each
color becomes one entry of the palette, and the palette holds at most 36 colors.

## Settings

| Variable | Use |
| --- | --- |
| `MUNITO_API_KEY` | Your Munito API key. It stays on your machine |
| `DURABLE_ACTORS_CONTROL_PLANE_URL` | Where the canvas actor runs |
| `DURABLE_ACTORS_PROJECT_ID` | The Terse project, or `local` |
| `DURABLE_ACTORS_API_KEY` | The Terse key, for Terse cloud only. The sandboxes get this one in their environment |
