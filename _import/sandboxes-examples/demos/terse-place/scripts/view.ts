// Serves the viewer page, which draws the picture live from the Grid actors of a run.
//
//   npm run view -- --run demo        then open http://localhost:8080
//
// With TERSE_PROJECT (or TERSE_ACTOR_URL) and TERSE_API_KEY, it watches the actors on Terse. Without them, it watches
// the local actors of `terse actor dev`. The API key stays in this process: the page gets a WebSocket grant for each
// actor from /grant.
import { readFileSync } from "node:fs"
import { createServer, type ServerResponse } from "node:http"
import { join } from "node:path"
import { parseArgs } from "node:util"

import { SocketProxy } from "terse-sdk/actors"

import { HEIGHT, WIDTH, loadPicture } from "./picture.ts"

const PICTURE = join(import.meta.dirname, "..", "pictures", "munito-sandboxes-swarm.svg")

const { values: options } = parseArgs({
    options: {
        run: { type: "string", default: "demo" },
        shards: { type: "string", default: "1" },
        port: { type: "string", default: "8080" },
        picture: { type: "string", default: PICTURE }
    }
})
const shards = Number(options.shards)
if (!(Number.isInteger(shards) && shards >= 1)) {
    console.error("--shards must be 1 or more")
    process.exit(2)
}
if (!process.env.TERSE_ACTOR_URL && process.env.TERSE_PROJECT) {
    process.env.TERSE_ACTOR_URL = `https://api.useterse.ai/${process.env.TERSE_PROJECT}/actors`
}
const { palette } = loadPicture(options.picture)
const page = readFileSync(join(import.meta.dirname, "..", "web", "index.html"))
const proxy = new SocketProxy({ Grid: {} as { types?: { viewer?: string } } })

function json(response: ServerResponse, body: unknown, status = 200): void {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" })
    response.end(JSON.stringify(body))
}

createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (url.pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page)
    } else if (url.pathname === "/config") {
        json(response, { run: options.run, shards, width: WIDTH, height: HEIGHT, palette })
    } else if (url.pathname === "/grant") {
        const shard = Number(url.searchParams.get("shard"))
        if (!Number.isInteger(shard) || shard < 0 || shard >= shards) {
            return json(response, { error: "no such actor" }, 400)
        }
        try {
            const actorId = `${options.run}-${shard}`
            const grant = await proxy.handle({ actorName: "Grid", actorId, metadata: { viewer: "browser" } })
            json(response, { url: grant.websocketUrl })
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            console.error(`No grant for Grid/${options.run}-${shard}: ${reason}`)
            json(response, { error: "no grant" }, 502)
        }
    } else {
        response.writeHead(404).end()
    }
}).listen(Number(options.port), "127.0.0.1", () => {
    console.log(`Open http://localhost:${options.port} to watch the actors Grid/${options.run}-0 to -${shards - 1}.`)
})
