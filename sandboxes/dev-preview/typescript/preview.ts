// Run a web server in a sandbox and open it in your browser.
//
//   export MUNITO_API_KEY="munitoai_..."
//   node preview.ts                 # keeps the sandbox for 15 minutes
//   node preview.ts --minutes 60
//
// Node 22.18 or later runs this file as it is, with no package to install.
//
// The script writes a small Node server into the sandbox, starts it on port 8080, and prints three ways to reach
// it: the private URL with the token of the sandbox, a signed URL for a browser, and the public URL. Press Ctrl-C
// to delete the sandbox. The sandbox also stops by itself at its timeout.

const API = "https://api.munito.ai/sandboxes/v1"
const PORT = 8080
const key = process.env.MUNITO_API_KEY
if (!key) {
    console.error("Set MUNITO_API_KEY to your Munito API key.")
    process.exit(1)
}

type Sandbox = { id: string; status: string; end_reason: string | null }
type ExecResult = { exit_code: number; stdout: string; stderr: string }
type SandboxPort = { port: number; public: boolean; url: string; token: string }
type SignedUrl = { url: string; expires_at: number }

const { values } = (await import("node:util")).parseArgs({ options: { minutes: { type: "string", default: "15" } } })
const minutes = Number(values.minutes)
if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    console.error("--minutes must be from 1 to 240.")
    process.exit(2)
}

/** One API call. Throws with the problem that the API returns on an HTTP error. */
async function api(method: string, path: string, body?: unknown, contentType = "application/json"): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
    if (body !== undefined) headers["Content-Type"] = contentType
    const payload = body === undefined || typeof body === "string" ? body : JSON.stringify(body)
    const response = await fetch(`${API}${path}`, { method, headers, body: payload })
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`)
    return response
}

async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await (await api(method, path, body)).json()) as T
}

// The server of the preview. Replace it with your own app, or with a command that starts one.
const SERVER = `const { createServer } = require("node:http")
createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  response.end(\`<h1>Hello from a Munito sandbox</h1>
    <p>Path: \${request.url}</p>
    <p>Time: \${new Date().toISOString()}</p>\`)
}).listen(${PORT}, "0.0.0.0", () => console.log("listening on ${PORT}"))
`

console.log("== Create a sandbox")
// The ubuntu template has Node. public_ports opens port 8080 for each person with its URL.
const create = {
    template: "ubuntu",
    size: "small",
    timeout: Math.round(minutes * 60),
    public_ports: [PORT],
    metadata: { example: "dev-preview" },
}
let sandbox = await json<Sandbox>("POST", "/sandboxes", create)
try {
    // The answer is "pending" when the start takes longer. Wait until the sandbox runs.
    while (sandbox.status === "pending") {
        await new Promise(resolve => setTimeout(resolve, 1000))
        sandbox = await json<Sandbox>("GET", `/sandboxes/${sandbox.id}`)
    }
    console.log(`${sandbox.id}: ${sandbox.status}`)

    console.log("== Write the server")
    const path = encodeURIComponent("/workspace/server.cjs")
    await api("PUT", `/sandboxes/${sandbox.id}/files/content?path=${path}`, SERVER, "application/octet-stream")

    console.log("== Start the server")
    // nohup and & keep the server running after the command ends.
    const start = "nohup node /workspace/server.cjs >/workspace/server.log 2>&1 & sleep 1; echo started"
    const started = await json<ExecResult>("POST", `/sandboxes/${sandbox.id}/exec`, { command: start })
    if (started.exit_code !== 0) throw new Error(`the server did not start: ${started.stderr}`)

    console.log("== Reach the port")
    const port = await json<SandboxPort>("GET", `/sandboxes/${sandbox.id}/ports/${PORT}`)
    // The token opens each port of the sandbox while the sandbox runs. Keep it secret.
    const direct = await fetch(port.url, { headers: { "munito-sandbox-token": port.token } })
    console.log(`${port.url}: HTTP ${direct.status}, ${(await direct.text()).length} bytes with the token`)

    // A signed URL opens one private port in a browser, and the browser keeps its access for 24 hours.
    const signed = await json<SignedUrl>("POST", `/sandboxes/${sandbox.id}/ports/${PORT}/url`, { expires_in: 3600 })
    const expires = new Date(signed.expires_at * 1000).toISOString()

    console.log("")
    console.log(`Public URL (open for each person): ${port.public ? port.url : "(port is private)"}`)
    console.log(`Signed URL (one browser, until ${expires}):`)
    console.log(`  ${signed.url}`)
    console.log("")
    console.log(`The sandbox stops by itself after ${minutes} minutes. Press Ctrl-C to delete it now.`)
    // Wait for Ctrl-C, or for the timeout of the sandbox. A timer keeps Node running; a signal handler alone does
    // not, and Node then ends the script here and deletes nothing.
    await new Promise<void>(resolve => {
        const until = setTimeout(resolve, minutes * 60_000)
        process.once("SIGINT", () => {
            clearTimeout(until)
            resolve()
        })
    })
    console.log("")
} finally {
    console.log("== Delete the sandbox")
    const ended = await json<Sandbox>("DELETE", `/sandboxes/${sandbox.id}`)
    console.log(`${ended.id}: ${ended.status}, ${ended.end_reason}`)
}
