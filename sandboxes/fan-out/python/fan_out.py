# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx[http2]>=0.27"]
# ///
"""Start N sandboxes at once, run a command in each, print the timings, and delete the sandboxes.

    export MUNITO_API_KEY="munitoai_..."
    uv run fan_out.py                             # 100 sandboxes
    uv run fan_out.py -n 20 --command "nproc"

The default command prints the boot id of the sandbox's kernel. Each sandbox is a separate microVM, so each
boot id is different. An organization in the preview runs at most 50 sandboxes at once, unless it asked for more.
A create above that limit gets 429 sandbox_limit_reached, and the script reports it.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import os
import signal
import statistics
import sys
import time
from collections import Counter

import httpx

API = "https://api.munito.ai/sandboxes/v1"


def code_of(response: httpx.Response) -> str:
    """The stable error code of a problem answer, or the HTTP status."""
    try:
        return response.json().get("code") or f"http_{response.status_code}"
    except ValueError:
        return f"http_{response.status_code}"


async def create(api: httpx.AsyncClient, size: str, index: int, ids: list[str]) -> tuple[float, str]:
    """The seconds until a new sandbox runs, and the outcome. The id of the sandbox goes into `ids` at once."""
    body = {"size": size, "timeout": 600, "metadata": {"example": "fan-out", "index": str(index)}}
    started = time.perf_counter()
    try:
        for _ in range(5):
            response = await api.post("/sandboxes", json=body)
            if response.status_code != 503 or code_of(response) != "no_capacity":
                break
            # No room for the sandbox now: wait as long as the API asks, then try again.
            await asyncio.sleep(float(response.headers.get("retry-after") or 1))
        if response.status_code != 201:
            return time.perf_counter() - started, code_of(response)
        sandbox = response.json()
        ids.append(sandbox["id"])
        # The answer is "pending" when the start takes longer. Wait until the sandbox runs.
        for _ in range(120):
            if sandbox.get("status") != "pending":
                break
            await asyncio.sleep(0.5)
            current = await api.get(f"/sandboxes/{sandbox['id']}")
            if current.status_code == 200:
                sandbox = current.json()
        return time.perf_counter() - started, "ok" if sandbox["status"] == "running" else sandbox["status"]
    except httpx.HTTPError as error:
        return time.perf_counter() - started, type(error).__name__


async def run(api: httpx.AsyncClient, sandbox_id: str, command: str) -> tuple[float, str, str]:
    """The seconds of one command, the outcome, and the first line of its output."""
    started = time.perf_counter()
    try:
        response = await api.post(f"/sandboxes/{sandbox_id}/exec", json={"command": command, "timeout": 60})
    except httpx.HTTPError as error:
        return time.perf_counter() - started, type(error).__name__, ""
    elapsed = time.perf_counter() - started
    if response.status_code != 200:
        return elapsed, code_of(response), ""
    result = response.json()
    outcome = "ok" if result["exit_code"] == 0 else f"exit {result['exit_code']}"
    return elapsed, outcome, (result["stdout"].strip().splitlines() or [""])[0]


async def delete(api: httpx.AsyncClient, sandbox_id: str) -> tuple[float, str]:
    started = time.perf_counter()
    try:
        response = await api.delete(f"/sandboxes/{sandbox_id}")
    except httpx.HTTPError as error:
        return time.perf_counter() - started, type(error).__name__
    return time.perf_counter() - started, "ok" if response.status_code == 200 else code_of(response)


def report(phase: str, wall: float, seconds: list[float], outcomes: list[str]) -> None:
    ok = outcomes.count("ok")
    if len(seconds) > 1:
        cuts = statistics.quantiles(seconds, n=10, method="inclusive")
        spread = f"p50 {statistics.median(seconds):.2f} s  p90 {cuts[8]:.2f} s  max {max(seconds):.2f} s"
    else:
        spread = f"max {max(seconds, default=0):.2f} s"
    print(f"{phase:<8}{ok:>5} of {len(outcomes):<5} ok in {wall:6.2f} s   {spread}")
    for outcome, count in Counter(o for o in outcomes if o != "ok").most_common():
        print(f"{'':<8}{count:>5} {outcome}")


def stop_on_interrupt() -> None:
    """Ctrl-C stops the run, then the script deletes its sandboxes. A second Ctrl-C does not stop the delete."""
    loop, task = asyncio.get_running_loop(), asyncio.current_task()

    def interrupt() -> None:
        loop.add_signal_handler(signal.SIGINT, lambda: None)
        if task is not None:
            task.cancel()

    # On Windows, Ctrl-C stops the script at once, and each sandbox stops at its timeout.
    with contextlib.suppress(NotImplementedError):
        loop.add_signal_handler(signal.SIGINT, interrupt)


async def main(count: int, command: str, size: str) -> int:
    key = os.environ.get("MUNITO_API_KEY")
    if not key:
        sys.exit("Set MUNITO_API_KEY to your Munito API key.")
    stop_on_interrupt()
    headers = {"Authorization": f"Bearer {key}"}
    # HTTP/2 sends all the requests over one connection, so the client does not open a connection for each one.
    async with httpx.AsyncClient(base_url=API, headers=headers, timeout=120, http2=True) as api:
        print(f"Starting {count} sandboxes of size {size} at once")
        ids: list[str] = []
        status = 1
        try:
            started = time.perf_counter()
            created = await asyncio.gather(*(create(api, size, i, ids) for i in range(count)))
            report("create", time.perf_counter() - started, [s for s, _ in created], [o for _, o in created])
            if any(outcome == "sandbox_limit_reached" for _, outcome in created):
                print("        Your organization reached its limit of running sandboxes. Use a smaller -n.")

            started = time.perf_counter()
            ran = await asyncio.gather(*(run(api, sandbox_id, command) for sandbox_id in ids))
            report("command", time.perf_counter() - started, [s for s, _, _ in ran], [o for _, o, _ in ran])
            outputs = [line for _, outcome, line in ran if outcome == "ok"]
            if outputs:
                print(f"{'':<8}{len(set(outputs)):>5} different outputs, such as: {outputs[0]}")
            status = 0 if len(outputs) == count else 1
        except asyncio.CancelledError:
            print("Interrupted. Deleting the sandboxes that started.")
            status = 130
        finally:
            started = time.perf_counter()
            deleted = await asyncio.gather(*(delete(api, sandbox_id) for sandbox_id in ids))
            report("delete", time.perf_counter() - started, [s for s, _ in deleted], [o for _, o in deleted])
    return status


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("-n", "--count", type=int, default=100, help="sandboxes to start at once (default 100)")
    parser.add_argument("--command", default="cat /proc/sys/kernel/random/boot_id", help="the command for each one")
    parser.add_argument("--size", default="small", choices=["small", "default", "large"], help="the size preset")
    args = parser.parse_args()
    if args.count < 1:
        parser.error("-n must be 1 or more")
    sys.exit(asyncio.run(main(args.count, args.command, args.size)))
