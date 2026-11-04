# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///
"""Sandboxes quick start in Python: create a sandbox, run a command, write and read a file, delete the sandbox.

    export MUNITO_API_KEY="munitoai_..."
    uv run quickstart.py
"""

from __future__ import annotations

import os
import sys
import time

import httpx

API = "https://api.munito.ai/sandboxes/v1"


def check(response: httpx.Response) -> httpx.Response:
    """The response, or exit with the problem that the API returned."""
    if response.is_error:
        sys.exit(f"{response.request.method} {response.request.url.path}: HTTP {response.status_code} {response.text}")
    return response


def main() -> None:
    key = os.environ.get("MUNITO_API_KEY")
    if not key:
        sys.exit("Set MUNITO_API_KEY to your Munito API key.")
    with httpx.Client(base_url=API, headers={"Authorization": f"Bearer {key}"}, timeout=120) as api:
        print("== Create a sandbox")
        body = {"size": "small", "timeout": 300, "metadata": {"example": "python-quickstart"}}
        sandbox = check(api.post("/sandboxes", json=body)).json()
        sandbox_id = sandbox["id"]
        try:
            # The answer is "pending" when the start takes longer. Wait until the sandbox runs.
            while sandbox["status"] == "pending":
                time.sleep(1)
                sandbox = check(api.get(f"/sandboxes/{sandbox_id}")).json()
            print(f"{sandbox_id}: {sandbox['status']}, {sandbox['vcpus']} vCPU, {sandbox['memory_mib']} MiB")

            print("== Run a command")
            command = 'python3 -c "import platform; print(platform.platform())"'
            result = check(api.post(f"/sandboxes/{sandbox_id}/exec", json={"command": command})).json()
            print(f"exit {result['exit_code']} in {result['duration_ms']} ms: {result['stdout'].strip()}")

            print("== Write a file")
            path = {"path": "/workspace/hello.py"}
            content = b'print("Hello from the sandbox")'
            octets = {"Content-Type": "application/octet-stream"}
            written = api.put(f"/sandboxes/{sandbox_id}/files/content", params=path, content=content, headers=octets)
            entry = check(written).json()
            print(f"{entry['path']}: {entry['size']} bytes")

            print("== Read the file")
            print(check(api.get(f"/sandboxes/{sandbox_id}/files/content", params=path)).text)

            print("== Run the file")
            result = check(api.post(f"/sandboxes/{sandbox_id}/exec", json={"command": ["python3", "hello.py"]})).json()
            print(result["stdout"], end="")

            print("== List /workspace")
            listing = check(api.get(f"/sandboxes/{sandbox_id}/files", params={"path": "/workspace"})).json()
            for item in listing["data"]:
                print(f"{item['type']}  {item['size']} bytes  {item['path']}")
        finally:
            print("== Delete the sandbox")
            ended = check(api.delete(f"/sandboxes/{sandbox_id}")).json()
            print(f"{sandbox_id}: {ended['status']}, {ended['end_reason']}")


if __name__ == "__main__":
    main()
