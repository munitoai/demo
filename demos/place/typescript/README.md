# Place — TypeScript

Thousands of Munito sandboxes paint one picture, one sandbox for each pixel. Each sandbox runs one `curl` that
calls `paint` on a [Terse](https://useterse.ai) durable actor. Your browser shows each paint as it comes.

Read [the demo README](../README.md) first for what the demo is and what the limits of the preview are.

Video: add the link here.

## The result

A picture has 368 by 89 pixels, so the whole picture takes 32,752 sandboxes. The picture of this demo is
[`pictures/munito-sandboxes-swarm.svg`](pictures/munito-sandboxes-swarm.svg): MUNITO and SANDBOXES in a swarm of
Munito cubes, with the Terse armadillo over TERSE. In the take for the launch, on 2026-10-30, its 32,752 sandboxes
painted the whole picture in 50.1 seconds, from the first create to the last paint, with 0 failures.

## How it works

1. [`scripts/paint.ts`](scripts/paint.ts) runs on your machine. It exchanges your Terse API key for an actor session,
   a token that lasts a few minutes.
2. For each pixel, `paint.ts` creates a sandbox through the Sandboxes API. The create gives the sandbox one command
   and the session token in its environment.
3. The command is a `curl` that calls `paint(pixel, color)` on the actor `Grid/<run>-<k>`, where `k` is the pixel
   number modulo the number of actors. [`scripts/painter.ts`](scripts/painter.ts) writes this command. The sandbox
   needs no other package.
4. The `Grid` actor in [`src/actor.ts`](src/actor.ts) keeps its share of the picture in memory. It sends each paint
   to each viewer.
5. `paint.ts` deletes each sandbox after its paint.
6. [`scripts/view.ts`](scripts/view.ts) serves the page [`web/index.html`](web/index.html) on your machine. It gives
   the page a WebSocket grant for each actor, and the page draws each paint.

A sandbox never gets your Terse API key or your Munito API key. It gets only the session token, and the token expires
after a few minutes.

One `Grid` actor holds the whole picture by default. For more paints a second, `--shards` splits the pixels over
several actors.

## Run it

You need:

- Node.js 22.18 or later.
- A Munito API key, for an organization with Sandboxes on. See [Get a key](../../../README.md#get-a-key).
- A Terse account and the Terse CLI. The CLI needs [Bun](https://bun.sh) 1.4.2 or later.

Do these steps in this folder:

1. Install the packages:

   ```bash
   npm install
   ```

2. Install the Terse CLI, and sign in:

   ```bash
   bunx terse-cli@latest install
   ```

3. Get the id of a Terse project. `terse init <name>` in another folder creates a project and prints its id. Put the id
   in `TERSE_PROJECT`, and link this folder to the project:

   ```bash
   export TERSE_PROJECT="your-project-id"
   echo "{\"projectId\": \"$TERSE_PROJECT\", \"name\": \"munito-terse-place\"}" > terse.config.json
   ```

4. Deploy the `Grid` actor to Terse:

   ```bash
   terse deploy
   ```

5. Create a Terse API key: open [app.useterse.ai](https://app.useterse.ai), and select **API keys** in the sidebar.
   Then set the keys:

   ```bash
   export TERSE_API_KEY="your-terse-api-key"
   export MUNITO_API_KEY="munitoai_..."
   ```

6. Start the viewer, and open http://localhost:8080:

   ```bash
   npm run view
   ```

7. In a second terminal with the same variables, paint 64 pixels:

   ```bash
   npm run paint
   ```

`npm run paint` prints its progress every 2 seconds. At the end, it prints the time from the first create to the last
paint, and the reason of each retry and failure. Ctrl-C starts no new sandbox: the sandboxes that run finish their
paint, and the script deletes them.

## Settings

| Variable | Use |
| --- | --- |
| `MUNITO_API_KEY` | Your Munito API key. Only `npm run paint` reads it. |
| `TERSE_PROJECT` | The id of your Terse project. |
| `TERSE_API_KEY` | Your Terse API key. It stays on your machine. |
| `TERSE_ACTOR_URL` | Optional. The actors of your project, in place of `TERSE_PROJECT`: `https://api.useterse.ai/<project>/actors`. |

| Option | Default | Use |
| --- | --- | --- |
| `--pixels` | `64` | The number of pixels to paint, from 1 to 32,752. `paint` only. |
| `--run` | `demo` | The name of the run. The actors are `Grid/<run>-0` to `Grid/<run>-<shards - 1>`. Use a new name for an empty canvas. |
| `--shards` | `1` | The number of actors that share the pixels. |
| `--workers` | `32` | The number of sandboxes at a time. `paint` only. |
| `--port` | `8080` | The port of the viewer. `view` only. |
| `--picture` | `pictures/munito-sandboxes-swarm.svg` | An SVG of one-pixel runs, 368 by 89 pixels, with at most 35 colors. |

Give the same `--run`, `--shards` and `--picture` to `view` and to `paint`, for example:

```bash
npm run view -- --run take-2
npm run paint -- --run take-2 --pixels 500
```

## Paint the whole picture

`npm run paint -- --pixels 32752` paints each pixel. Two limits of the preview apply:

- An organization runs at most 100 sandboxes at once. `paint.ts` deletes each sandbox after its paint, so it stays under
  this limit with the default of 32 workers. The take for the launch ran in an organization with a higher limit. It
  kept each painter for at least 60 seconds after its paint, so all 32,752 sandboxes ran at the same time.
- The API takes at most 8,000 requests a minute from one IP address. Each pixel takes a create and a delete, so one
  machine paints at most about 4,000 pixels a minute. The take for the launch sent its creates from 10 sandboxes, each
  with its own address.

## Try the actor on your machine

`terse actor dev` runs the actors on port 7100 of your machine, with no Terse account. The sandboxes cannot reach your
machine, but `curl` can paint, and `npm run view` shows the local actors when `TERSE_PROJECT` and `TERSE_ACTOR_URL`
are not set:

```bash
terse actor dev     # first terminal
npm run view        # second terminal, then open http://localhost:8080
curl -sS http://127.0.0.1:7100/v1/projects/local/actors/Grid/demo-0/invoke \
  -H "Content-Type: application/json" -d '{"requestId": "try-1", "method": "paint", "args": [0, 5]}'
```

`npm run check` type-checks the actor and the scripts.

## Files

| File | What it is |
| --- | --- |
| `src/actor.ts` | The `Grid` actor, which Terse runs. `terse deploy` and `terse actor dev` use `tsconfig.json`. |
| `scripts/painter.ts` | The command of each sandbox: one `curl`. |
| `scripts/paint.ts` | Gets the actor session, starts the sandboxes, and deletes them. |
| `scripts/view.ts`, `web/index.html` | The viewer: a local server and the page that draws the picture. |
| `scripts/picture.ts` | Reads a picture into a palette and the color of each pixel. |
| `pictures/` | The picture of the demo. |

The pictures show the marks of Munito and Terse. The MIT license of this repository covers the code, not these marks.
