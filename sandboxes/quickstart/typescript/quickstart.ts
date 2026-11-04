// Sandboxes quick start in TypeScript: create a sandbox, run a command, write and read a file, delete the sandbox.
//
//   export MUNITO_API_KEY="munitoai_..."
//   node quickstart.ts
//
// Node 22.18 or later runs this file as it is, with no package to install.

const API = "https://api.munito.ai/sandboxes/v1"
const key = process.env.MUNITO_API_KEY
if (!key) {
    console.error("Set MUNITO_API_KEY to your Munito API key.")
    process.exit(1)
}

type Sandbox = { id: string; status: string; template: string; vcpus: number; memory_mib: number; end_reason: string | null }
type ExecResult = { exit_code: number; stdout: string; stderr: string; duration_ms: number }
type FileEntry = { name: string; path: string; type: string; size: number }

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

console.log("== Create a sandbox")
let sandbox = await json<Sandbox>("POST", "/sandboxes", { size: "small", timeout: 300, metadata: { example: "typescript-quickstart" } })
try {
    // The answer is "pending" when the start takes longer. Wait until the sandbox runs.
    while (sandbox.status === "pending") {
        await new Promise(resolve => setTimeout(resolve, 1000))
        sandbox = await json<Sandbox>("GET", `/sandboxes/${sandbox.id}`)
    }
    console.log(`${sandbox.id}: ${sandbox.status}, ${sandbox.vcpus} vCPU, ${sandbox.memory_mib} MiB`)

    console.log("== Run a command")
    const command = `python3 -c "import platform; print(platform.platform())"`
    let result = await json<ExecResult>("POST", `/sandboxes/${sandbox.id}/exec`, { command })
    console.log(`exit ${result.exit_code} in ${result.duration_ms} ms: ${result.stdout.trim()}`)

    console.log("== Write a file")
    const file = `/sandboxes/${sandbox.id}/files/content?path=${encodeURIComponent("/workspace/hello.py")}`
    const written = await api("PUT", file, 'print("Hello from the sandbox")', "application/octet-stream")
    const entry = (await written.json()) as FileEntry
    console.log(`${entry.path}: ${entry.size} bytes`)

    console.log("== Read the file")
    console.log(await (await api("GET", file)).text())

    console.log("== Run the file")
    result = await json<ExecResult>("POST", `/sandboxes/${sandbox.id}/exec`, { command: ["python3", "hello.py"] })
    process.stdout.write(result.stdout)

    console.log("== List /workspace")
    const listing = await json<{ data: FileEntry[] }>("GET", `/sandboxes/${sandbox.id}/files?path=/workspace`)
    for (const item of listing.data) console.log(`${item.type}  ${item.size} bytes  ${item.path}`)
} finally {
    console.log("== Delete the sandbox")
    const ended = await json<Sandbox>("DELETE", `/sandboxes/${sandbox.id}`)
    console.log(`${ended.id}: ${ended.status}, ${ended.end_reason}`)
}
