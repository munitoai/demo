// A code interpreter: a model writes a Python script for your question, and a sandbox runs it.
//
//   export MUNITO_API_KEY="munitoai_..."
//   npm install
//   npm start "How many prime numbers are there below one million?"
//
// The model runs on the OpenAI-compatible inference API of Munito AI, and the same key starts the sandbox. The
// sandbox has no network, because nobody reviews the code that the model writes. When a script fails, the model
// gets the error and writes a new script. The model writes at most three scripts. Set MUNITO_MODEL for another
// model.

import OpenAI from "openai"

const INFERENCE = "https://api.munito.ai/inference/v1"
const SANDBOXES = "https://api.munito.ai/sandboxes/v1"
const MODEL = process.env.MUNITO_MODEL ?? "qwen/qwen3.8-27b"
const ATTEMPTS = 3
const SYSTEM =
    "You write one Python 3.12 script that answers the user's question and prints the answer. " +
    "Use only the standard library. The script has no network access. " +
    "Reply with the script in one ```python code block and nothing else."
const CODE_BLOCK = /```(?:python|py)?[ \t]*\n([\s\S]*?)```/

const key = process.env.MUNITO_API_KEY
if (!key) {
    console.error("Set MUNITO_API_KEY to your Munito API key.")
    process.exit(1)
}

type ExecResult = { exit_code: number; stdout: string; stderr: string; duration_ms: number; timed_out: boolean }

/** One call to the Sandboxes API. Throws with the problem that the API returns on an HTTP error. */
async function api(method: string, path: string, body?: unknown, contentType = "application/json"): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
    if (body !== undefined) headers["Content-Type"] = contentType
    const payload = body === undefined || typeof body === "string" ? body : JSON.stringify(body)
    const response = await fetch(`${SANDBOXES}${path}`, { method, headers, body: payload })
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`)
    return response
}

const question = process.argv.slice(2).join(" ") || "How many prime numbers are there below one million?"
const model = new OpenAI({ baseURL: INFERENCE, apiKey: key })
const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: question },
]
console.log(`Question: ${question}`)

const created = { size: "small", timeout: 600, internet: false, metadata: { example: "code-interpreter" } }
const sandbox = (await (await api("POST", "/sandboxes", created)).json()) as { id: string }
const file = `/sandboxes/${sandbox.id}/files/content?path=${encodeURIComponent("/workspace/main.py")}`
let status = 1
try {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const reply = await model.chat.completions.create({ model: MODEL, messages, max_tokens: 4096 })
        const text = reply.choices[0]?.message.content ?? ""
        const script = `${(CODE_BLOCK.exec(text)?.[1] ?? text).trim()}\n`
        console.log(`\n--- Script ${attempt}, from ${MODEL} ---\n${script}`)

        await api("PUT", file, script, "application/octet-stream")
        const run = { command: ["python3", "main.py"], timeout: 60 }
        const result = (await (await api("POST", `/sandboxes/${sandbox.id}/exec`, run)).json()) as ExecResult
        if (result.exit_code === 0) {
            console.log(`--- Output, in ${result.duration_ms} ms ---\n${result.stdout.trimEnd()}`)
            status = 0
            break
        }
        const error = result.stderr.slice(-4000) || "(no error output)"
        const timedOut = result.timed_out ? " after its timeout of 60 s" : ""
        console.log(`--- Exit code ${result.exit_code}${timedOut} ---\n${error.trimEnd()}`)
        messages.push({ role: "assistant", content: text })
        messages.push({ role: "user", content: `The script failed${timedOut}. Its error output:\n${error}\nFix it.` })
    }
    if (status !== 0) console.log(`No script ran without an error after ${ATTEMPTS} attempts.`)
} finally {
    await api("DELETE", `/sandboxes/${sandbox.id}`)
}
process.exit(status)
