"""Render the same C++ scene with CUDA or a native CPU compiler."""

import argparse
import ctypes as ct
import importlib.util
import io
import json
import os
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
V = [(-1.46, 0.94), (-0.84, 0.94), (-0.42, -0.22), (0.025, 0.94), (0.60, 0.94), (-0.19, -0.95), (-0.69, -0.95)]
I = [(0.72, 0.94), (1.39, 0.94), (1.39, -0.86), (1.30, -0.95), (0.72, -0.95)]


def distance_field():
    """Sample the signed distance to the vector outlines. Both backends use this field."""
    x, y = np.meshgrid(np.linspace(-1.65, 1.65, 1024, dtype="f"), np.linspace(-1.18, 1.18, 768, dtype="f"))
    field = np.full(x.shape, np.inf, dtype="f")
    for polygon in (V, I):
        nearest = np.full(x.shape, np.inf, dtype="f")
        inside = np.zeros(x.shape, dtype=bool)
        for (ax, ay), (bx, by) in zip(polygon, polygon[1:] + polygon[:1]):
            dx, dy = bx - ax, by - ay
            h = np.clip(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
            nearest = np.minimum(nearest, np.square(x - ax - h * dx) + np.square(y - ay - h * dy))
            if dy:
                inside ^= ((ay > y) != (by > y)) & (x < ax + (y - ay) * dx / dy)
        field = np.minimum(field, np.where(inside, -1.0, 1.0).astype("f") * np.sqrt(nearest))
    return np.ascontiguousarray(field)


def checked(code, operation):
    if code:
        raise RuntimeError(f"{operation} failed with CUDA error {code}")


def cuda_kernel(source):
    import torch

    torch.cuda.init()
    driver = ct.CDLL("libcuda.so.1")
    libraries = ["libnvrtc.so.12", "libnvrtc.so"]
    package = importlib.util.find_spec("nvidia.cuda_nvrtc")
    if package and package.submodule_search_locations:
        for path in package.submodule_search_locations:
            libraries.extend(str(p) for p in Path(path, "lib").glob("libnvrtc.so*"))
    for lib in libraries:
        try:
            nvrtc = ct.CDLL(lib)
            break
        except OSError:
            continue
    else:
        raise RuntimeError("The GPU image needs the NVIDIA runtime compiler.")
    program = ct.c_void_p()
    checked(nvrtc.nvrtcCreateProgram(ct.byref(program), source, b"vi.cu", 0, None, None), "nvrtcCreateProgram")
    major, minor = torch.cuda.get_device_capability()
    options = (ct.c_char_p * 2)(b"--std=c++17", f"--gpu-architecture=compute_{major}{minor}".encode())
    status = nvrtc.nvrtcCompileProgram(program, len(options), options)
    size = ct.c_size_t()
    if status:
        nvrtc.nvrtcGetProgramLogSize(program, ct.byref(size))
        log = ct.create_string_buffer(size.value)
        nvrtc.nvrtcGetProgramLog(program, log)
        raise RuntimeError(log.value.decode())
    checked(nvrtc.nvrtcGetPTXSize(program, ct.byref(size)), "nvrtcGetPTXSize")
    ptx = ct.create_string_buffer(size.value)
    checked(nvrtc.nvrtcGetPTX(program, ptx), "nvrtcGetPTX")
    checked(nvrtc.nvrtcDestroyProgram(ct.byref(program)), "nvrtcDestroyProgram")
    module, kernel = ct.c_void_p(), ct.c_void_p()
    checked(driver.cuModuleLoadData(ct.byref(module), ptx), "cuModuleLoadData")
    checked(driver.cuModuleGetFunction(ct.byref(kernel), module, b"render"), "cuModuleGetFunction")
    return driver, kernel


def gpu_frames(field, w, h, count, samples):
    import torch

    data = [
        torch.from_numpy(field).cuda(),
        torch.empty((h, w, 3), dtype=torch.uint8, device="cuda"),
    ]
    driver, kernel = cuda_kernel((HERE / "vi.cpp").read_bytes())
    stream = ct.c_void_p(torch.cuda.current_stream().cuda_stream)
    for index in range(count):
        args = [ct.c_void_p(t.data_ptr()) for t in data] + [ct.c_int(n) for n in (w, h, index, count, samples)]
        pointers = (ct.c_void_p * len(args))(*(ct.addressof(a) for a in args))
        checked(
            driver.cuLaunchKernel(kernel, (w * h + 127) // 128, 1, 1, 128, 1, 1, 0, stream, pointers, None),
            "cuLaunchKernel",
        )
        yield data[-1].cpu().numpy()


def cpu_frames(field, w, h, count, samples, threads):
    with tempfile.TemporaryDirectory() as tmp, ThreadPoolExecutor(max_workers=threads) as pool:
        library = Path(tmp, "vi.so")
        subprocess.run(
            [
                os.environ.get("CXX", "c++"),
                "-O3",
                "-std=c++17",
                "-shared",
                "-fPIC",
                str(HERE / "vi.cpp"),
                "-o",
                str(library),
            ],
            check=True,
        )
        native = ct.CDLL(str(library))
        native.rows.argtypes = [ct.c_void_p] * 2 + [ct.c_int] * 7
        native.rows.restype = None
        frame = np.empty((h, w, 3), dtype="uint8")
        for index in range(count):
            base = (field.ctypes.data, frame.ctypes.data, w, h, index, count, samples)
            rows = [pool.submit(native.rows, *base, h * i // threads, h * (i + 1) // threads) for i in range(threads)]
            for task in rows:
                task.result()
            yield frame


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", choices=["cuda", "cpu"], required=True)
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--height", type=int, default=960)
    parser.add_argument("--frames", type=int, default=96)
    parser.add_argument("--samples", type=int, default=8)
    parser.add_argument("--threads", type=int, default=os.cpu_count() or 2)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    start = time.perf_counter()
    args.output.mkdir(exist_ok=True, parents=True)
    data = (
        distance_field(),
        args.width,
        args.height,
        args.frames,
        args.samples,
    )
    sequence = gpu_frames(*data) if args.device == "cuda" else cpu_frames(*data, args.threads)
    with ZipFile(args.output / "frames.zip", "w") as archive:
        for i, pixels in enumerate(sequence):
            image = Image.fromarray(pixels)
            if i == 0:
                image.save(args.output / "vi.png")
            stream = io.BytesIO()
            image.save(stream, "JPEG", quality=93, subsampling=0)
            archive.writestr(f"{i:04}.jpg", stream.getvalue())
    print(
        json.dumps(
            dict(
                device=args.device,
                width=args.width,
                height=args.height,
                frames=args.frames,
                samples=args.samples,
                render_seconds=time.perf_counter() - start,
            )
        )
    )


if __name__ == "__main__":
    main()
