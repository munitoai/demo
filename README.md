# Demo

A minimal React app with TypeScript, Vite, and TanStack Router.
The home page has a counter. The About page checks navigation.
The app needs no API, account, or database.

## Run

1. Run `mise trust` in this folder.
2. Run `mise install` to select the pinned Node version.
3. Run `mise run setup` to install the locked dependencies.
4. Run `mise run dev`.
5. Open `http://127.0.0.1:5173`.

With Node 24 or later and npm 11.10 or later, use `npm ci` and `npm run dev` directly.

Run `npm run check` to check the format, types, and build.
Run `npm run preview` to inspect the build at `http://127.0.0.1:4173`.

## Security rules

The source is `../monorepo` at commit `41a4367ed7bfaa8687e958037b349b9bc5b908d8`.

- `.npmrc`, `.prettierrc.json`, and `tsconfig.base.json` are direct copies from `monorepo/typescript`.
- `.npmrc` enforces the same seven-day delay for dependency releases.
- `mise.toml` uses the monorepo's Node pin. Direct dependencies use its lockfile versions.
- `.gitignore` retains the rules for secrets, private keys, state files, and local credentials.
- Dependabot retains weekly updates and the seven-day delay.
- CI retains read-only permissions, pinned actions, and a checkout without stored credentials.
- The pre-commit configuration retains the applicable file checks.
- `security.ts` adapts the console's `src/server/csp.ts` and `src/server/public-web.ts`.

Both local servers bind to `127.0.0.1`.
They send the frame, MIME, referrer, permissions, cache, and robot headers from the console.
The preview uses a CSP that permits only local scripts and styles.
The development CSP retains the console's frame rule because Vite injects scripts and styles.

The app has no inline production script, SSR script, external API, or embedded frame.
Its production policy therefore needs no nonce, external origin, or eval exception.
Keep secrets out of source code and browser variables.
Keep document contents, prompts, and responses out of logs.

The generated `dist/` folder does not configure another web server's headers.
Apply `securityHeaders()` at that server before deployment.
The GitHub configuration takes effect only after this folder becomes a GitHub repository.
Install the hooks with `prek install` after Git initialization.

## Test data

`data/` contains four public sample documents from the Bruno OCR requests.
Run `npm run data:fetch` to restore them.
The manifest records their sources and checksums.
The app does not serve or bundle these documents.

Router reference: [TanStack documentation](https://tanstack.com/router/latest/docs/routing/code-based-routing).
