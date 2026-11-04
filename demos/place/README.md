# Place: one sandbox for each pixel

Thousands of Munito sandboxes paint one picture, one sandbox for each pixel. Each sandbox runs a single `curl` that
paints its pixel on a durable actor, and your browser watches the picture fill in over a WebSocket.

A picture of 368 by 89 pixels takes 32,752 sandboxes. In the take for the launch, on 2026-10-30, the 32,752
sandboxes painted the whole picture in 50.1 seconds, from the first create to the last paint, with no failure.

This is the stress test of the Sandboxes API, not a quick start. Read
[`sandboxes/quickstart`](../../sandboxes/quickstart) first.

## Two versions

| Version | The actor runs on | Start here if |
| --- | --- | --- |
| [`typescript/`](typescript) | [Terse](https://useterse.ai) cloud, with the Terse CLI | You want the version of the launch, with sharding and a Terse project |
| [`python/`](python) | A Terse durable actor, in the cloud or on your machine | You prefer Python, or you want to run the actor locally behind a tunnel |

Both versions do the same three things:

1. Read a picture into a palette and the color of each pixel.
2. Create one sandbox for each pixel, each with one command: a `curl` that calls `paint(pixel, color)` on the actor.
3. Serve a local page that subscribes to the actor and draws each paint as it arrives.

A sandbox never gets your Munito API key or your Terse API key. It gets only a short-lived token for the actor.

## What it needs

- A Munito API key, for an organization with Sandboxes on. See [Get a key](../../README.md#get-a-key).
- A place for the actor. [Terse](https://useterse.ai) is a durable actor runtime, and it is the one dependency
  these two demos have beyond the Sandboxes API. Each version's README gives the steps.
- The TypeScript version needs Node.js 22.18 or later and the Terse CLI. The Python version needs
  [uv](https://docs.astral.sh/uv/).

## Limits of the preview

- An organization runs a limited number of sandboxes at once. Both scripts delete each sandbox after its paint, so
  a default run stays under the limit. The take for the launch ran in an organization with a higher limit, and it
  kept each sandbox alive, so all 32,752 ran at the same time.
- The API takes a limited number of requests a minute from one IP address. Each pixel takes a create and a delete,
  so one machine paints a few thousand pixels a minute. The take for the launch sent its creates from 10 sandboxes,
  each with its own address.

Start small. `--pixels 64` in the TypeScript version, or `--scale 0.25` in the Python version, paints in seconds.

## The pictures

The pictures show the marks of Munito and of Terse. The MIT license of this repository covers the code, not these
marks.
