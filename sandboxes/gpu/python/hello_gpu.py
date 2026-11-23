# /// script
# requires-python = ">=3.12"
# dependencies = ["munitoai==0.1.0"]
# ///
from munitoai import App

app = App(region="eu")


@app.function(gpu="L4")
def torch_version():
    import torch

    return torch.__version__


print(torch_version.remote())
