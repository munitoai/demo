// Start N sandboxes at once, run a command in each, print the timings, and delete the sandboxes.
//
//   export MUNITO_API_KEY="munitoai_..."
//   node fan-out.ts                          # 100 sandboxes
//   node fan-out.ts --count 20 --command nproc
//
// Node 22.18 or later runs this file as it is, with no package to install.
//
// The default command prints the boot id of the sandbox's kernel. Each sandbox is a separate microVM, so each
// boot id is different. An organization in the preview runs a limited number of sandboxes at once. A create above
// that limit gets 429 sandbox_limit_reached, and the script reports it.

const API = "https://api.munito.ai/sandboxes/v1"
const key = process.env.MUNITO_API_KEY
if (!key) {
    console.error("Set MUNITO_API_KEY to your Munito API key.")
    process.exit(1)
}

type Sandbox = { id: string; status: string }
type ExecResult = { exit_code: number; stdout: string }
type Outcome = { seconds: number; outcome: string; line?: string }

const { values } = (await import("node:util")).parseArgs({
    options: {
        count: { type: "string", default: "100" },
        command: { type: "string", default: "cat /proc/sys/kernel/random/boot_id" },
        size: { type: "string", default: "small" },
    },
})
const count = Number(values.count)
if (!Number.isInteger(count) || count < 1) {
    console.error("--count must be 1 or more.")
    process.exit(2)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** One API call. It never throws: the caller reads the status. */
async function call(method: string, path: string, body?: unknown): Promise<Response | null> {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
    if (body !== undefined) headers["Content-Type"] = "application/json"
    const payload = body === undefined ? undefined : JSON.stringify(body)
    try {
        return await fetch(`${API}${path}`, { method, headers, body: payload })
    } catch {
        return null
    }
}

/** The stable error code of a problem answer, or the HTTP status. */
async function codeOf(response: Response): Promise<string> {
    try {
        return ((await response.clone().json()) as { code?: string }).code ?? `http_${response.status}`
    } catch {
        return `http_${response.status}`
    }
}

/** The seconds until a new sandbox runs, and the outcome. The id goes into `ids` at once. */
async function create(index: number, ids: string[]): Promise<Outcome> {
    const body = { size: values.size, timeout: 600, metadata: { example: "fan-out", index: String(index) } }
    const started = performance.now()
    const seconds = () => (performance.now() - started) / 1000
    let response: Response | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
        response = await call("POST", "/sandboxes", body)
        if (response === null) return { seconds: seconds(), outcome: "fetch_failed" }
        // No room for the sandbox now: wait as long as the API asks, then try again.
        if (response.status !== 503 || (await codeOf(response)) !== "no_capacity") break
        await sleep(Number(response.headers.get("retry-after") ?? 1) * 1000)
    }
    if (response === null || response.status !== 201) {
        return { seconds: seconds(), outcome: response === null ? "fetch_failed" : await codeOf(response) }
    }
    let sandbox = (await response.json()) as Sandbox
    ids.push(sandbox.id)
    // The answer is "pending" when the start takes longer. Wait until the sandbox runs.
    for (let attempt = 0; attempt < 120 && sandbox.status === "pending"; attempt++) {
        await sleep(500)
        const current = await call("GET", `/sandboxes/${sandbox.id}`)
        if (current?.ok) sandbox = (await current.json()) as Sandbox
    }
    return { seconds: seconds(), outcome: sandbox.status === "running" ? "ok" : sandbox.status }
}

/** The seconds of one command, the outcome, and the first line of its output. */
async function run(id: string, command: string): Promise<Outcome> {
    const started = performance.now()
    const response = await call("POST", `/sandboxes/${id}/exec`, { command, timeout: 60 })
    const seconds = (performance.now() - started) / 1000
    if (response === null) return { seconds, outcome: "fetch_failed" }
    if (!response.ok) return { seconds, outcome: await codeOf(response) }
    const result = (await response.json()) as ExecResult
    const outcome = result.exit_code === 0 ? "ok" : `exit ${result.exit_code}`
    return { seconds, outcome, line: result.stdout.trim().split("\n")[0] ?? "" }
}

async function remove(id: string): Promise<Outcome> {
    const started = performance.now()
    const response = await call("DELETE", `/sandboxes/${id}`)
    const seconds = (performance.now() - started) / 1000
    if (response === null) return { seconds, outcome: "fetch_failed" }
    return { seconds, outcome: response.ok ? "ok" : await codeOf(response) }
}

function report(phase: string, wall: number, results: Outcome[]): void {
    const seconds = results.map(r => r.seconds).sort((a, b) => a - b)
    const at = (q: number) => seconds[Math.min(seconds.length - 1, Math.floor(q * seconds.length))] ?? 0
    const ok = results.filter(r => r.outcome === "ok").length
    const spread = `p50 ${at(0.5).toFixed(2)} s  p90 ${at(0.9).toFixed(2)} s  max ${at(1).toFixed(2)} s`
    console.log(`${phase.padEnd(8)}${String(ok).padStart(5)} of ${String(results.length).padEnd(5)} ok in ${wall.toFixed(2).padStart(6)} s   ${spread}`)
    const failures = new Map<string, number>()
    for (const r of results) if (r.outcome !== "ok") failures.set(r.outcome, (failures.get(r.outcome) ?? 0) + 1)
    for (const [outcome, n] of [...failures].sort((a, b) => b[1] - a[1])) {
        console.log(`${"".padEnd(8)}${String(n).padStart(5)} ${outcome}`)
    }
}

console.log(`Starting ${count} sandboxes of size ${values.size} at once`)
const ids: string[] = []
let status = 1
try {
    let started = performance.now()
    const created = await Promise.all(Array.from({ length: count }, (_, i) => create(i, ids)))
    report("create", (performance.now() - started) / 1000, created)
    if (created.some(r => r.outcome === "sandbox_limit_reached")) {
        console.log("        Your organization reached its limit of running sandboxes. Use a smaller --count.")
    }

    started = performance.now()
    const ran = await Promise.all(ids.map(id => run(id, values.command!)))
    report("command", (performance.now() - started) / 1000, ran)
    const outputs = ran.filter(r => r.outcome === "ok").map(r => r.line!)
    if (outputs.length > 0) {
        console.log(`        ${String(new Set(outputs).size).padStart(5)} different outputs, such as: ${outputs[0]}`)
    }
    status = outputs.length === count ? 0 : 1
} finally {
    // Delete every sandbox that started, also after an error. The timeout stops the rest.
    const started = performance.now()
    const deleted = await Promise.all(ids.map(remove))
    report("delete", (performance.now() - started) / 1000, deleted)
}
process.exit(status)
