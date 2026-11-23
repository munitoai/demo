# /// script
# requires-python = ">=3.12"
# dependencies = ["munitoai==0.1.0"]
# ///
from munitoai import App

app = App(region="eu")


@app.function(gpu="L4:2")
def gpu_names():
    import torch

    return [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())]


print(gpu_names.remote())
