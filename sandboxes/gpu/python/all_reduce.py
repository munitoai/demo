# /// script
# requires-python = ">=3.12"
# dependencies = ["munitoai==0.1.0"]
# ///
from pathlib import Path

from munitoai import App

app = App(region="eu")


@app.function(gpu="L4:2", timeout=600)
def all_reduce(worker_source):
    import os
    import subprocess
    from pathlib import Path

    worker = Path("/workspace/worker.py")
    worker.write_text(worker_source)
    result = subprocess.run(
        [
            "python3",
            "-m",
            "torch.distributed.run",
            "--standalone",
            "--local-addr=127.0.0.1",
            "--nproc-per-node=2",
            str(worker),
        ],
        env={**os.environ, "NCCL_SOCKET_IFNAME": "lo", "NCCL_IB_DISABLE": "1", "NCCL_P2P_DISABLE": "1"},
        check=True,
        stdout=subprocess.PIPE,
        text=True,
        timeout=120,
    )
    return result.stdout.strip()


print(all_reduce.remote(Path(__file__).with_name("worker.py").read_text()))
