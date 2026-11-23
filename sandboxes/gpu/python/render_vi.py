# /// script
# requires-python = ">=3.12"
# dependencies = ["munitoai==0.1.0b1", "imageio-ffmpeg==0.6.0"]
# ///
from munitoai import Munito

from glass_vi import render_video

with Munito(region="eu") as client:
    print(render_video(client, gpu="L4", frames=120))
