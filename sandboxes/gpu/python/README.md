# GPU sandboxes with the Python SDK

Use [uv](https://docs.astral.sh/uv/getting-started/installation/) and set `MUNITO_API_KEY` to a [workspace key](https://console.munito.ai/keys) from an organization with GPU access. Run these commands from this directory. Each script declares its Python version and local dependencies for uv. The EU sandbox image supplies PyTorch and Transformers.

| Script | Run it | Result |
| --- | --- | --- |
| [Hello, GPU](hello_gpu.py) | `uv run hello_gpu.py` | Prints the PyTorch version from one L4 sandbox. |
| [Glass VI](render_vi.py) | `uv run render_vi.py` | Renders 120 frames on one L4 and prints the path to the finished MP4. |
| [Two GPUs](two_gpus.py) | `uv run two_gpus.py` | Prints the names of both GPUs in the same sandbox. |
| [Distributed sum](all_reduce.py) | `uv run all_reduce.py` | Starts one PyTorch worker per GPU and sums 1 and 2 with NCCL. |
| [Tiny language model](train_tiny_gpt.py) | `uv run train_tiny_gpt.py` | Prints the first and last next-token training losses for a one-layer GPT. |

The [render helper](glass_vi.py) uses the SDK to upload the [Python renderer](renderer.py) and [native scene](vi.cpp), run the CUDA code, and download the frames. The helper deletes the sandbox and encodes the MP4 locally. The output directory also contains the first frame (`vi.png`) and the run measurements (`timings.json`).

See the [GPU sandbox guide](https://docs.munito.ai/sandboxes/gpu) for the video and pricing. The [reference measurements](timings.json) cover two runs per device. The L4 times include sandbox creation, transfer, deletion, and local encoding. The eight-vCPU sandbox was ready when its timer started.
