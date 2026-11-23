"""Render the glass VI with the Munito SDK and encode the downloaded frames locally."""

import json
import subprocess
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


def render_video(client: Munito, *, gpu: str = "L4", frames: int = 120) -> Path:
    """Return the local MP4 path. Save the first frame and timings beside it."""
    if frames < 1:
        raise ValueError("frames must be positive")
    start = time.perf_counter()
    output = Path(tempfile.mkdtemp(prefix="vi-l4-", dir=".")).resolve()
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp, "frames.zip")
        box = client.sandboxes.create(gpu=gpu, timeout=900)
        try:
            create_seconds = time.perf_counter() - start
            while box.status == "pending" and time.time() < box.expires_at:
                time.sleep(1)
                box = client.sandboxes.get(box.id)
            if box.status != "running":
                raise RuntimeError(f"GPU sandbox {box.id} is {box.status}")
            for name in FILES:
                client.sandboxes.write_file(box.id, f"/workspace/{name}", (HERE / name).read_bytes())
            result = client.sandboxes.exec(
                box.id,
                [
                    "python3",
                    "/workspace/renderer.py",
                    "--device",
                    "cuda",
                    "--output",
                    "/workspace/result",
                    "--width",
                    "960",
                    "--height",
                    "960",
                    "--frames",
                    str(frames),
                    "--samples",
                    "8",
                ],
                timeout=780,
            )
            if result.exit_code:
                raise RuntimeError(result.stderr)
            details = json.loads(result.stdout)
            (output / "vi.png").write_bytes(client.sandboxes.read_file(box.id, "/workspace/result/vi.png"))
            archive.write_bytes(client.sandboxes.read_file(box.id, "/workspace/result/frames.zip"))
        finally:
            client.sandboxes.delete(box.id)
        video = output / "vi.mp4"
        encode(archive, video)
    details.update(create_seconds=create_seconds, total_seconds=time.perf_counter() - start)
    (output / "timings.json").write_text(json.dumps(details, indent=2) + "\n")
    return video
