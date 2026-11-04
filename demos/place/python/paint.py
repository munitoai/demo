"""Paint a picture on a Terse canvas actor with Munito sandboxes: one sandbox for each pixel, and each one runs a
single command, a curl that paints its pixel.

    python paint.py pictures/munito-boxes-terse-actor.png --scale 0.5    # paint, and serve the viewer
    python paint.py --watch                                                # only serve the viewer

MUNITO_API_KEY is a Munito API key. DURABLE_ACTORS_CONTROL_PLANE_URL and DURABLE_ACTORS_PROJECT_ID say where the
canvas actor runs, and DURABLE_ACTORS_API_KEY is the Terse key, for Terse cloud only. The sandboxes need no package:
they reach the actor with curl. Each sandbox ends by itself after --lifetime seconds.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import secrets
import shlex
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

import httpx
from durable_actors import Client
from PIL import Image

MUNITO_URL = "https://api.munito.ai/sandboxes/v1"
LOCAL = {"127.0.0.1", "localhost", "::1"}


def load(path: Path, scale: float) -> tuple[int, int, list[str], list[int]]:
    """The picture's width and height, its palette, and the palette index of each pixel, row by row."""
    image = Image.open(path).convert("RGB")
    if scale != 1:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.NEAREST)
    colors = sorted(image.getcolors(image.width * image.height), reverse=True)
    palette = [bytes(rgb).hex() for _, rgb in colors]
    index = {rgb: i for i, (_, rgb) in enumerate(colors)}
    return image.width, image.height, palette, [index[rgb] for rgb in image.getdata()]


def paint_command(origin: str, project: str, canvas: str, token: str, pixel: int, color: int, keyed: bool) -> str:
    """A curl that paints one pixel. It fails unless the actor completed the call, so the sandbox can try again."""
    url = f"{origin}/v1/projects/{project}/actors/Canvas/{quote(canvas)}/invoke"
    body = f'{{"requestId":"{canvas}-{token}-{pixel}","method":"paint","args":["{token}",{pixel},{color}]}}'
    auth = ' -H "authorization: Bearer $TERSE_KEY"' if keyed else ""
    return (
        f"curl -sS -m 10 --retry 4 --retry-all-errors -X POST {shlex.quote(url)}"
        f" -H 'content-type: application/json'{auth} -d {shlex.quote(body)} | grep -q completed"
    )


def serve(terse: Client, canvas: str, port: int) -> None:
    """The viewer page, and a fresh WebSocket grant for it at /grant: a grant is good for one minute."""
    page = Path(__file__).with_name("viewer.html").read_bytes()

    class Viewer(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/grant":
                url = urlsplit(terse.prepare_websocket("Canvas", canvas, None).websocket_url)
                origin = urlsplit(terse.origin)
                if url.hostname in LOCAL and origin.hostname not in LOCAL:
                    # A local runtime behind a tunnel names its own address: use the tunnel's.
                    url = url._replace(scheme="wss" if origin.scheme == "https" else "ws", netloc=origin.netloc)
                body, kind = json.dumps({"url": urlunsplit(url)}).encode(), "application/json"
            else:
                body, kind = page, "text/html; charset=utf-8"
            self.send_response(200)
            self.send_header("content-type", kind)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args: object) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", port), Viewer)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"Watch the canvas at http://127.0.0.1:{port}", flush=True)


class Painter:
    def __init__(self, munito: httpx.Client, lifetime: int, env: dict[str, str]) -> None:
        self.munito, self.lifetime, self.env = munito, lifetime, env
        self.lock = threading.Lock()
        self.created = self.painted = self.failed = 0

    def call(self, method: str, path: str, body: dict) -> httpx.Response | None:
        """One API call, again after a refusal that asks for it, or None when the call keeps failing."""
        for attempt in range(8):
            try:
                answer = self.munito.request(method, path, json=body)
            except httpx.HTTPError:
                answer = None
            if answer is not None and answer.status_code < 500 and answer.status_code != 429:
                return answer
            wait = float(answer.headers.get("retry-after", 1)) if answer is not None else 1.0
            time.sleep(min(10.0, wait * (1 + attempt) * random.uniform(0.8, 1.3)))
        return None

    def paint(self, command: str, pixel: int) -> None:
        body = {
            "size": "small",
            "internet": True,
            "timeout": self.lifetime,
            "command": command,
            "env": self.env,
            "metadata": {"demo": "terse-canvas", "pixel": str(pixel)},
        }
        answer = self.call("POST", "/sandboxes", body)
        if answer is None or answer.status_code != 201:
            with self.lock:
                self.failed += 1
            return
        created = answer.json()
        with self.lock:
            self.created += 1
        ok = (created.get("command") or {}).get("exit_code") == 0
        if not ok:
            again = self.call("POST", f"/sandboxes/{created['id']}/exec", {"command": command, "timeout": 60})
            ok = again is not None and again.status_code == 200 and again.json().get("exit_code") == 0
        with self.lock:
            if ok:
                self.painted += 1
            else:
                self.failed += 1


def paint(terse: Client, args: argparse.Namespace, key: str) -> int:
    width, height, palette, colors = load(args.picture, args.scale)
    token = secrets.token_urlsafe(12)
    terse.invoke("Canvas", args.canvas, "setup", [width, height, palette, token])
    print(f"{width} x {height} = {width * height} pixels, so {width * height} sandboxes", flush=True)
    keyed = bool(os.environ.get("DURABLE_ACTORS_API_KEY"))
    env = {"TERSE_KEY": os.environ["DURABLE_ACTORS_API_KEY"]} if keyed else {}
    pixels = list(enumerate(colors))
    random.shuffle(pixels)
    started = time.time()
    with httpx.Client(base_url=MUNITO_URL, headers={"authorization": f"Bearer {key}"}, timeout=120) as munito:
        painter = Painter(munito, args.lifetime, env)
        with ThreadPoolExecutor(args.workers) as pool:
            for pixel, color in pixels:
                command = paint_command(terse.origin, terse.project_id, args.canvas, token, pixel, color, keyed)
                pool.submit(painter.paint, command, pixel)
            while painter.painted + painter.failed < len(pixels):
                print(f"\r{painter.created} sandboxes, {painter.painted} painted, {painter.failed} failed", end="")
                time.sleep(1)
    print(
        f"\r{painter.created} sandboxes, {painter.painted} painted, {painter.failed} failed"
        f" in {time.time() - started:.1f} s. Each ends by itself {args.lifetime} s after its start.",
        flush=True,
    )
    return 0 if painter.failed == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("picture", type=Path, nargs="?")
    parser.add_argument("--watch", action="store_true", help="only serve the viewer of the canvas")
    parser.add_argument("--scale", type=float, default=0.25, help="1 paints the whole picture")
    parser.add_argument("--canvas", default="munito-boxes", help="the id of the canvas actor")
    parser.add_argument("--workers", type=int, default=64, help="sandbox creates in flight")
    parser.add_argument("--lifetime", type=int, default=120, help="seconds before each sandbox ends by itself")
    parser.add_argument("--port", type=int, default=8000, help="the port of the viewer")
    args = parser.parse_args()
    key = os.environ.get("MUNITO_API_KEY", "")
    if not args.watch and (not key or not args.picture):
        print("Set MUNITO_API_KEY and name a picture, or pass --watch.", file=sys.stderr)
        return 2
    terse = Client()
    serve(terse, args.canvas, args.port)
    result = 0 if args.watch else paint(terse, args, key)
    print("The canvas keeps the picture. Press Ctrl-C to stop the viewer.", flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        return result


if __name__ == "__main__":
    sys.exit(main())
