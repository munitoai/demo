// Chat with an open model on the OpenAI-compatible API of Munito AI.
//
//   export MUNITO_API_KEY="munitoai_..."
//   npm install
//   npm start
//   npm start "Why is EU data residency useful?"
//   MUNITO_MODEL=google/gemma-4-12b npm start
//
// The OpenAI client reaches Munito AI with one change: the base URL. The same key works for the Anthropic client
// at https://api.munito.ai/inference, and for the Sandboxes API. To keep the work in the EU, use the EU host,
// https://api.eu.munito.ai/inference/v1.

import OpenAI from "openai"

const API = process.env.MUNITO_BASE_URL ?? "https://api.munito.ai/inference/v1"
const MODEL = process.env.MUNITO_MODEL ?? "qwen/qwen3.8-27b"
const QUESTION = "Say hello in one sentence."

const key = process.env.MUNITO_API_KEY
if (!key) {
    console.error("Set MUNITO_API_KEY to your Munito API key.")
    process.exit(1)
}

const question = process.argv.slice(2).join(" ") || QUESTION
const client = new OpenAI({ baseURL: API, apiKey: key })
const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "user", content: question }]
console.log(`Question: ${question}\n`)

// The public chat models reason by default, so give the answer room: a small max_tokens can go to reasoning alone.
console.log("== One answer, with the token counts")
const answer = await client.chat.completions.create({ model: MODEL, messages, max_tokens: 1024 })
console.log(answer.choices[0]?.message.content)
const usage = answer.usage
console.log(`\n[${answer.model}: ${usage?.prompt_tokens} prompt + ${usage?.completion_tokens} completion tokens]`)

console.log("\n== The same answer as a stream")
// Each event holds one piece of the answer. stream_options asks for the token counts in the last event.
const stream = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 1024,
    stream: true,
    stream_options: { include_usage: true },
})
let completionTokens = 0
for await (const event of stream) {
    if (event.usage) completionTokens = event.usage.completion_tokens
    for (const choice of event.choices) process.stdout.write(choice.delta.content ?? "")
}
console.log(`\n\n[${completionTokens} completion tokens]`)

console.log("\n== Which models you can call")
for await (const model of client.models.list()) console.log(model.id)
