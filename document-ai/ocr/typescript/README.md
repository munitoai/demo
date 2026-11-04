# OCR — TypeScript, in a browser

A small React app that reads a PDF or an image into Markdown. Pick a file, pick a model, and the page shows the
Markdown of each page.

The app is React with [TanStack Router](https://tanstack.com/router/latest) and Vite. It is the one example here
that runs in a browser, so it also shows **where the API key belongs**: in your server, never in the page.

## Run

```bash
export MUNITO_API_KEY="munitoai_..."
mise install          # the pinned Node version
npm ci                # the locked dependencies
node ../data/fetch.mjs  # the sample documents, which Git does not keep
npm run dev
```

Then open `http://127.0.0.1:5173` and pick a file from `../data/`.

With Node 24 or later and npm 11.10 or later, `npm ci` and `npm run dev` work without mise.

`npm run check` checks the format, the types and the build. `npm run preview` serves the build at
`http://127.0.0.1:4173`.

## Where the key lives

The browser never gets the key. The page posts to `/api/ocr` on its own origin. The Vite dev server proxies that
path to `https://api.munito.ai/inference/v1/ocr` and adds `Authorization: Bearer $MUNITO_API_KEY` from its own
environment. `vite.config.ts` holds those eight lines.

`npm run dev` refuses to start without `MUNITO_API_KEY`, so the app never sends an unauthenticated request.

`npm run preview` serves the build with no proxy, so the reader gets a 404 there. The preview checks the static
build and its headers, and your own server replaces the proxy in production.

## What it shows

- A document as base64 in `POST /inference/v1/ocr`, which is what a file from a browser gives you.
- The answer: one entry in `pages` for each page, with the Markdown of the page in `markdown`.
- `202` for a long document, and the poll of `GET /inference/v1/ocr/{request_id}` until the status is no longer
  `running`.
- `usage`, with the billed pages, the cost and the region that read the pages.

The page shows the Markdown as it comes, in a `pre` block, so you read exactly what the API returned. The app has
no Markdown renderer on purpose.

## Security

The app keeps the rules of the Munito console: `.npmrc` refuses a package version younger than seven days,
`security.ts` sends the frame, MIME, referrer, permissions, cache and robot headers, and both local servers bind to
`127.0.0.1`. The production policy allows local scripts and styles only. The app has no inline script, no external
origin and no frame, so it needs no nonce and no `eval` exception.

`dist/` does not configure another web server's headers. Apply `securityHeaders()` at that server before you deploy.
