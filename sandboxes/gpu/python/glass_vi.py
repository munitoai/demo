# /// script
# requires-python = ">=3.12"
# dependencies = ["munitoai==0.1.0", "imageio-ffmpeg==0.6.0", "numpy", "pillow"]
# ///
"""Render a Roman VI on one L4 or benchmark the same scene on the local CPU."""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from zipfile import ZipFile

import imageio_ffmpeg
from munitoai import Munito

HERE = Path(__file__).resolve().parent
FILES = ("renderer.py", "vi.cpp")


def encode(archive_path, target):
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-framerate",
        "24",
        "-c:v",
        "mjpeg",
        "-i",
        "-",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "17",
        "-movflags",
        "+faststart",
        str(target),
    ]
    with ZipFile(archive_path) as archive, subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
        for frame in sorted(archive.namelist()):
            encoder.stdin.write(archive.read(frame))
    if encoder.returncode:
        raise RuntimeError(f"MP4 encoding failed with exit code {encoder.returncode}")


def _render_gpu(client, gpu, args, scratch, times):
    start = time.perf_counter()
    box = client.sandboxes.create(gpu=gpu, timeout=900)
    try:
        times["create_seconds"] = time.perf_counter() - start
        while box.status == "pending" and time.time() < box.expires_at:
            time.sleep(1)
            box = client.sandboxes.get(box.id)
        if box.status != "running":
            raise RuntimeError(f"GPU sandbox {box.id} is {box.status}")
        for name in FILES:
            client.sandboxes.write_file(box.id, "/workspace/" + name, (HERE / name).read_bytes())
        result = client.sandboxes.exec(
            box.id,
            ["python3", "/workspace/renderer.py", "--device", "cuda", "--output", "/workspace/result", *args],
            timeout=780,
        )
        if result.exit_code:
            raise RuntimeError(result.stderr)
        for name in ("vi.png", "frames.zip"):
            (scratch / name).write_bytes(client.sandboxes.read_file(box.id, "/workspace/result/" + name))
        return json.loads(result.stdout)
    finally:
        client.sandboxes.delete(box.id)


def render_video(client: Munito | None, *, gpu="L4", frames=120, size=960, samples=8) -> Path:
    """Return the finished MP4 path. Pass a Munito client for a GPU or None for a local CPU benchmark."""
    if size < 2 or size % 2:
        raise ValueError("size must be a positive even number for H.264 video")
    if frames < 1 or samples < 1:
        raise ValueError("frames and samples must be positive")
    start = time.perf_counter()
    mode = "cpu" if client is None else "l4"
    output = Path(tempfile.mkdtemp(prefix=f"vi-{mode}-", dir=".")).resolve()
    args = [
        "--width",
        str(size),
        "--height",
        str(size),
        "--frames",
        str(frames),
        "--samples",
        str(samples),
    ]
    times = {}
    print(f"Rendering {frames} frames on {mode}. Output: {output}", flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        scratch = Path(tmp)
        if client is None:
            result = subprocess.run(
                [sys.executable, str(HERE / "renderer.py"), "--device", "cpu", "--output", tmp, *args],
                check=True,
                capture_output=True,
                text=True,
            )
            details = json.loads(result.stdout)
            times["cpu_threads"] = os.cpu_count()
        else:
            details = _render_gpu(client, gpu, args, scratch, times)
        shutil.copyfile(scratch / "vi.png", output / "vi.png")
        encode(scratch / "frames.zip", output / "vi.mp4")
    times["total_seconds"] = time.perf_counter() - start
    report = {**details, **times}
    (output / "timings.json").write_text(json.dumps(report, indent=2) + "\n")
    return output / "vi.mp4"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cpu", action="store_true", help="Use the local C++ compiler and all local CPU threads.")
    parser.add_argument("--size", type=int, default=960)
    parser.add_argument("--frames", type=int, default=120)
    parser.add_argument("--samples", type=int, default=8, help="Subpixel samples per pixel.")
    options = parser.parse_args()
    kwargs = dict(frames=options.frames, size=options.size, samples=options.samples)
    if options.cpu:
        video = render_video(None, **kwargs)
    else:
        with Munito(region="eu") as client:
            video = render_video(client, **kwargs)
    print((video.parent / "timings.json").read_text().strip())
    print(video)


if __name__ == "__main__":
    main()
