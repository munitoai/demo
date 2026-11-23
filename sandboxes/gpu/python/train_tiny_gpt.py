# /// script
# requires-python = ">=3.12"
# dependencies = ["munitoai==0.1.0"]
# ///
from munitoai import App

with App(region="eu") as app:
    @app.function(gpu="L4")
    def train():
        import torch
        from transformers import GPT2Config, GPT2LMHeadModel

        torch.manual_seed(7)
        tokens = torch.tensor([list(b"Paris est en France.")], device="cuda")
        model = GPT2LMHeadModel(GPT2Config(vocab_size=256, n_positions=32, n_embd=64, n_layer=1, n_head=2)).cuda()
        optimizer = torch.optim.AdamW(model.parameters(), lr=0.003)
        losses = []
        for _ in range(32):
            optimizer.zero_grad()
            loss = model(tokens, labels=tokens).loss
            loss.backward()
            optimizer.step()
            losses.append(loss.item())
        return [round(losses[0], 3), round(losses[-1], 3)]

    print(train.remote())
