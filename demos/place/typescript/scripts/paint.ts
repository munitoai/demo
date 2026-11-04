// Paints the picture with Munito sandboxes, one sandbox for each pixel. Each sandbox runs one curl that calls `paint`
// on a Terse actor, and the script deletes the sandbox after its paint.
//
//   npm run paint                          paint 64 pixels
//   npm run paint -- --pixels 32752        paint the whole picture
//
// Settings from the environment:
//   MUNITO_API_KEY    a Munito API key, for an organization with Sandboxes on
//   TERSE_PROJECT     the id of the Terse project of the Grid actor
//   TERSE_API_KEY     a Terse API key. It stays on this machine: the sandboxes get a session of a few minutes.
//   TERSE_ACTOR_URL   optional, in place of TERSE_PROJECT: https://api.useterse.ai/<project>/actors
import { join } from "node:path"
import { parseArgs } from "node:util"

import { painterCommand } from "./painter.ts"
import { HEIGHT, WIDTH, loadPicture } from "./picture.ts"

const SANDBOXES = "https://api.munito.ai/sandboxes/v1"
const PICTURE = join(import.meta.dirname, "..", "pictures", "munito-sandboxes-swarm.svg")

const { values: options } = parseArgs({
    options: {
        pixels: { type: "string", default: "64" },
        run: { type: "string", default: "demo" },
        shards: { type: "string", default: "1" },
        workers: { type: "string", default: "32" },
        picture: { type: "string", default: PICTURE }
    }
})
const count = Number(options.pixels)
const shards = Number(options.shards)
const workers = Number(options.workers)
const run = options.run
if (!(Number.isInteger(count) && count >= 1 && count <= WIDTH * HEIGHT)) fail(`--pixels must be 1 to ${WIDTH * HEIGHT}`)
if (!(Number.isInteger(shards) && shards >= 1) || !(Number.isInteger(workers) && workers >= 1)) {
    fail("--shards and --workers must be 1 or more")
}
if (!/^[A-Za-z0-9._-]{1,40}$/.test(run)) fail("--run takes letters, digits, '.', '_' and '-' only")

const munitoKey = process.env.MUNITO_API_KEY
const terseKey = process.env.TERSE_API_KEY
const project = process.env.TERSE_PROJECT
const actorUrl = process.env.TERSE_ACTOR_URL || (project ? `https://api.useterse.ai/${project}/actors` : "")
if (!munitoKey) fail("Set MUNITO_API_KEY to your Munito API key.")
if (!terseKey || !actorUrl) fail("Set TERSE_API_KEY, and TERSE_PROJECT to the id of your Terse project.")

type Session = { projectId: string; controlPlaneUrl: string; token: string; expiresAtMs: number }
type Result = { exit_code: number; stderr: string }
type Created = { id: string; command: Result | null }

/**
 * A Terse actor session: a token that lasts a few minutes and only calls the actors of the project. The sandboxes
 * carry it in place of the API key.
 */
async function openSession(): Promise<Session> {
    const response = await fetch(`${actorUrl}/access`, {
        method: "POST",
        headers: { Authorization: `Bearer ${terseKey}`, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(10_000)
    })
    if (!response.ok) {
        const hint = "Check TERSE_API_KEY and TERSE_PROJECT."
        throw new Error(`Terse refused an actor session (HTTP ${response.status}). ${hint}`)
    }
    const session = (await response.json()) as Session
    if (!session.token || !/^https:\/\/[^\s']+$/.test(session.controlPlaneUrl)) {
        throw new Error("Terse sent a session that this script cannot use")
    }
    return session
}

function api(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${munitoKey}` }
    if (body !== undefined) headers["Content-Type"] = "application/json"
    return fetch(`${SANDBOXES}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(120_000)
    })
}

/** A new sandbox and the result of its command, or undefined when the creates keep failing. */
async function create(body: object): Promise<Created | undefined> {
    for (let attempt = 0; attempt < 30; attempt++) {
        let response: Response
        try {
            response = await api("POST", "/sandboxes", body)
        } catch {
            await sleep(1000)
            continue
        }
        if (response.status === 201) return (await response.json()) as Created
        const problem = (await response.json().catch(() => ({}))) as { code?: string }
        note(`create: HTTP ${response.status} ${problem.code ?? ""}`.trim())
        // 429: the organization runs its most sandboxes at once, or sends too many requests. 503: no room now.
        if (![429, 503].includes(response.status) || problem.code === "start_unknown") return undefined
        await sleep(1000 * Number(response.headers.get("retry-after") || 1) * (0.8 + Math.random() * 0.4))
    }
    return undefined
}

async function paintPixel(pixel: number, color: number): Promise<boolean> {
    // Pixel i goes to the actor Grid/<run>-<i % shards>, so the actors share the paints.
    const actors = `${session.controlPlaneUrl}/v1/projects/${encodeURIComponent(session.projectId)}/actors`
    const command = painterCommand(actors, `${run}-${pixel % shards}`, pixel, color, `${runId}-p${pixel}`)
    const sandbox = await create({
        size: "small",
        // The sandbox stops by itself after 2 minutes, also when this script stops first.
        timeout: 120,
        env: { TERSE_SESSION: session.token },
        command,
        metadata: { demo: "terse-place", run, pixel: String(pixel) }
    })
    if (!sandbox) return false
    started += 1
    try {
        if (sandbox.command?.exit_code === 0) return true
        note(`paint: ${sandbox.command?.stderr.trim().split("\n").pop() || "the command did not run"}`)
        // Run the command one more time in the same sandbox.
        const again = await api("POST", `/sandboxes/${sandbox.id}/exec`, { command, timeout: 60 })
        const result = again.ok ? ((await again.json()) as Result) : undefined
        if (result?.exit_code === 0) return true
        note(`paint again: ${result?.stderr.trim().split("\n").pop() || `HTTP ${again.status}`}`)
        return false
    } finally {
        for (let attempt = 0; attempt < 3; attempt++) {
            const deleted = await api("DELETE", `/sandboxes/${sandbox.id}`).catch(() => undefined)
            if (deleted?.ok || deleted?.status === 404) break
            await sleep(1000)
        }
    }
}

/** Counts one reason of a failure or a retry, for the summary at the end. */
function note(reason: string): void {
    errors.set(reason, (errors.get(reason) ?? 0) + 1)
}

function fail(message: string): never {
    console.error(message)
    process.exit(2)
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/** The pixels in a fixed random order, so that a part of the picture spreads over the whole canvas. */
function order(total: number): number[] {
    const pixels = Array.from({ length: total }, (_, i) => i)
    let seed = 27
    const random = () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    for (let i = total - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        const swap = pixels[i]
        pixels[i] = pixels[j]
        pixels[j] = swap
    }
    return pixels
}

const { colors } = loadPicture(options.picture)
const queue = order(WIDTH * HEIGHT).slice(0, count)
const runId = `${run}-${Date.now().toString(36)}`
const errors = new Map<string, number>()
let session = await openSession().catch(error => fail(String(error)))
let renewal: ReturnType<typeof setTimeout> | undefined
let started = 0
let painted = 0
let failed = 0
let stopping = false
let lastPaint = 0

// A session lasts a few minutes: take a new one a minute before the end. New sandboxes get the new token.
function renewLater(): void {
    renewal = setTimeout(async () => {
        try {
            session = await openSession()
        } catch (error) {
            console.error(String(error))
        }
        renewLater()
    }, Math.max(10_000, session.expiresAtMs - Date.now() - 60_000))
}
renewLater()
// Ctrl-C starts no new sandbox. The sandboxes that run finish their paint, and the script deletes them.
process.on("SIGINT", () => {
    if (!stopping) console.log("Stopping. The script deletes the sandboxes that run after their paint.")
    stopping = true
})

const actorNames = shards === 1 ? `the actor Grid/${run}-0` : `the actors Grid/${run}-0 to -${shards - 1}`
console.log(`Painting ${count} pixels on ${actorNames}, ${workers} sandboxes at a time.`)
console.log(`Watch it with: npm run view -- --run ${run} --shards ${shards}`)
const begin = performance.now()
const progress = setInterval(() => {
    const seconds = ((performance.now() - begin) / 1000).toFixed(1)
    console.log(`${seconds} s: ${started} sandboxes started, ${painted} pixels painted, ${failed} failed`)
}, 2000)
let next = 0
await Promise.all(
    Array.from({ length: Math.min(workers, count) }, async () => {
        while (!stopping && next < queue.length) {
            const pixel = queue[next++]
            const ok = await paintPixel(pixel, colors[pixel]).catch(error => {
                note(String(error))
                return false
            })
            if (ok) {
                painted += 1
                lastPaint = performance.now()
            } else {
                failed += 1
            }
        }
    })
)
clearInterval(progress)
clearTimeout(renewal)
const time = (((lastPaint || performance.now()) - begin) / 1000).toFixed(1)
console.log(`Painted ${painted} of ${count} pixels with ${started} sandboxes in ${time} s. ${failed} failed.`)
if (errors.size) console.log("Retries and failures:")
for (const [reason, times] of errors) console.log(`  ${times} x ${reason}`)
process.exitCode = painted === count ? 0 : 1
