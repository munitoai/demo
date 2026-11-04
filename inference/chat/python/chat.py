# /// script
# requires-python = ">=3.10"
# dependencies = ["openai>=1.40"]
# ///
"""Chat with an open model on the OpenAI-compatible API of Munito AI.

    export MUNITO_API_KEY="munitoai_..."
    uv run chat.py
    uv run chat.py "Why is EU data residency useful?"
    MUNITO_MODEL=google/gemma-4-12b uv run chat.py

The OpenAI client reaches Munito AI with one change: the base URL. The same key works for the Anthropic client at
https://api.munito.ai/inference, and for the Sandboxes API. To keep the work in the EU, use the EU host,
https://api.eu.munito.ai/inference/v1.
"""

from __future__ import annotations

import os
import sys

from openai import OpenAI

API = os.environ.get("MUNITO_BASE_URL", "https://api.munito.ai/inference/v1")
MODEL = os.environ.get("MUNITO_MODEL", "qwen/qwen3.8-27b")
QUESTION = "Say hello in one sentence."


def main() -> int:
    key = os.environ.get("MUNITO_API_KEY")
    if not key:
        sys.exit("Set MUNITO_API_KEY to your Munito API key.")
    question = " ".join(sys.argv[1:]) or QUESTION
    client = OpenAI(base_url=API, api_key=key)
    messages = [{"role": "user", "content": question}]
    print(f"Question: {question}\n")

    # The public chat models reason by default, so give the answer room: a small max_tokens can go to reasoning alone.
    print("== One answer, with the token counts")
    answer = client.chat.completions.create(model=MODEL, messages=messages, max_tokens=1024)
    usage = answer.usage
    print(answer.choices[0].message.content)
    print(f"\n[{answer.model}: {usage.prompt_tokens} prompt + {usage.completion_tokens} completion tokens]")

    print("\n== The same answer as a stream")
    # Each event holds one piece of the answer. stream_options asks for the token counts in the last event.
    stream = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=1024,
        stream=True,
        stream_options={"include_usage": True},
    )
    final = None
    for event in stream:
        if event.usage is not None:
            final = event.usage
        for choice in event.choices:
            print(choice.delta.content or "", end="", flush=True)
    if final is not None:
        print(f"\n\n[{final.completion_tokens} completion tokens]")

    print("\n== Which models you can call")
    for model in client.models.list().data:
        print(model.id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
