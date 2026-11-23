import os

import torch
import torch.distributed as dist

rank = int(os.environ["LOCAL_RANK"])
torch.cuda.set_device(rank)
dist.init_process_group("nccl")
try:
    value = torch.tensor([rank + 1], device=f"cuda:{rank}")
    dist.all_reduce(value)
    if rank == 0:
        print(f"GPUs: {dist.get_world_size()}, sum: {value.item()}")
finally:
    dist.destroy_process_group()
