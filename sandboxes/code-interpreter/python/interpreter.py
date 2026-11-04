# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27", "openai>=1.40"]
# ///
"""A code interpreter: a model writes a Python script for your question, and a sandbox runs it.

    export MUNITO_API_KEY="munitoai_..."
    uv run interpreter.py "How many prime numbers are there below one million?"

The model runs on the OpenAI-compatible inference API of Munito AI, and the same key starts the sandbox. The
sandbox has no network, because nobody reviews the code that the model writes. When a script fails, the model gets
the error and writes a new script. The model writes at most three scripts. Set MUNITO_MODEL to use another model.
"""

from __future__ import annotations

import os
import re
import sys

import httpx
from openai import OpenAI

INFERENCE = "https://api.munito.ai/inference/v1"
SANDBOXES = "https://api.munito.ai/sandboxes/v1"
MODEL = os.environ.get("MUNITO_MODEL", "qwen/qwen3.8-27b")
ATTEMPTS = 3
SYSTEM = (
    "You write one Python 3.12 script that answers the user's question and prints the answer. "
    "Use only the standard library. The script has no network access. "
    "Reply with the script in one ```python code block and nothing else."
)
CODE_BLOCK = re.compile(r"```(?:python|py)?[ \t]*\n(.*?)```", re.DOTALL)


def check(response: httpx.Response) -> httpx.Response:
    """The response, or exit with the problem that the API returned."""
    if response.is_error:
        sys.exit(f"{response.request.method} {response.request.url.path}: HTTP {response.status_code} {response.text}")
    return response


def main() -> int:
    key = os.environ.get("MUNITO_API_KEY")
    if not key:
        sys.exit("Set MUNITO_API_KEY to your Munito API key.")
    question = " ".join(sys.argv[1:]) or "How many prime numbers are there below one million?"
    model = OpenAI(base_url=INFERENCE, api_key=key)
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    print(f"Question: {question}")
    with httpx.Client(base_url=SANDBOXES, headers={"Authorization": f"Bearer {key}"}, timeout=120) as api:
        body = {"size": "small", "timeout": 600, "internet": False, "metadata": {"example": "code-interpreter"}}
        sandbox_id = check(api.post("/sandboxes", json=body)).json()["id"]
        try:
            for attempt in range(1, ATTEMPTS + 1):
                reply = model.chat.completions.create(model=MODEL, messages=messages, max_tokens=4096)
                text = reply.choices[0].message.content or ""
                found = CODE_BLOCK.search(text)
                script = (found.group(1) if found else text).strip() + "\n"
                print(f"\n--- Script {attempt}, from {MODEL} ---\n{script}")
                octets = {"Content-Type": "application/octet-stream"}
                path = {"path": "/workspace/main.py"}
                check(api.put(f"/sandboxes/{sandbox_id}/files/content", params=path, content=script, headers=octets))
                run = {"command": ["python3", "main.py"], "timeout": 60}
                result = check(api.post(f"/sandboxes/{sandbox_id}/exec", json=run)).json()
                if result["exit_code"] == 0:
                    print(f"--- Output, in {result['duration_ms']} ms ---\n{result['stdout'].rstrip()}")
                    return 0
                error = result["stderr"][-4000:] or "(no error output)"
                timed_out = " after its timeout of 60 s" if result["timed_out"] else ""
                print(f"--- Exit code {result['exit_code']}{timed_out} ---\n{error.rstrip()}")
                messages.append({"role": "assistant", "content": text})
                messages.append(
                    {"role": "user", "content": f"The script failed{timed_out}. Its error output:\n{error}\nFix it."}
                )
            print(f"No script ran without an error after {ATTEMPTS} attempts.")
            return 1
        finally:
            check(api.delete(f"/sandboxes/{sandbox_id}"))


if __name__ == "__main__":
    sys.exit(main())
