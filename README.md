# Munito Boxes × Terse Actor

Thousands of [Munito](https://munito.ai) sandboxes paint one picture. Each sandbox is a microVM that paints one
pixel on a [Terse](https://www.useterse.ai) durable actor, and your browser watches the actor live over a WebSocket.

<!-- The video goes here. -->

## How it works

- `src/actors.py`: the `Canvas` actor keeps the picture. Each `paint` call sets one pixel and goes to every viewer.
- `paint.py`: starts one Munito sandbox for each pixel. The sandbox runs one command, a `curl` to the actor, so it
  needs no package. It ends by itself after `--lifetime` seconds.
- `viewer.html`: draws the canvas. `paint.py` serves it on port 8000, with a fresh WebSocket grant for each connection.

## Run it

You need [uv](https://docs.astral.sh/uv/), a Munito API key (Sandboxes is in preview), and a place for the actor:

1. Install: `uv sync`.
2. Start the actor. The sandboxes must reach it from the internet.
   - **Terse cloud:** run `terse deploy`. Then set `DURABLE_ACTORS_CONTROL_PLANE_URL`, `DURABLE_ACTORS_PROJECT_ID`
     and `DURABLE_ACTORS_API_KEY` from your Terse project.
   - **Your machine:** run `uv run durable-actors dev`, and give it a public address, for example
     `cloudflared tunnel --url http://127.0.0.1:7100`. Set `DURABLE_ACTORS_CONTROL_PLANE_URL` to that address and
     `DURABLE_ACTORS_PROJECT_ID=local`.
3. Paint, then open http://127.0.0.1:8000:

   ```bash
   MUNITO_API_KEY=... uv run python paint.py pictures/munito-boxes-terse-actor.png
   ```

The default `--scale 0.25` paints 92 × 22 = 2,024 pixels: a test run did it in 32 s with one local Terse runtime.
`--scale 1` paints all 368 × 89 = 32,752. Any PNG works: each color becomes one entry of the palette.
`uv run python paint.py --watch` serves the viewer of a canvas that is already painted.
