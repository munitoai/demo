"""The canvas of the demo: one durable actor holds the picture, takes one paint from each sandbox, and sends each
paint to every viewer over a WebSocket."""

from typing import Any

from durable_actors import Actor, ActorSocket, JsonValue, persisted

# One character for each color of the palette. "." is a pixel that no sandbox painted yet.
CODES = "0123456789abcdefghijklmnopqrstuvwxyz"


class Canvas(Actor):
    width: int = persisted(0)
    height: int = persisted(0)
    palette: list[str] = persisted(default_factory=list)
    token: str = persisted("")
    pixels: str = persisted("")
    painted: int = persisted(0)

    def setup(self, width: int, height: int, palette: list[str], token: str) -> None:
        """Start an empty picture. Only a caller with the token can paint it."""
        if len(palette) > len(CODES):
            raise ValueError(f"a picture has at most {len(CODES)} colors")
        self.width, self.height, self.palette, self.token = width, height, palette, token
        self.pixels = "." * (width * height)
        self.painted = 0
        self.broadcast(self._snapshot())

    def paint(self, token: str, index: int, color: int) -> int:
        """Paint one pixel, and return how many pixels are painted."""
        if token != self.token or not 0 <= index < len(self.pixels) or not 0 <= color < len(self.palette):
            raise ValueError("not a pixel of this canvas")
        if self.pixels[index] == ".":
            self.painted += 1
        self.pixels = self.pixels[:index] + CODES[color] + self.pixels[index + 1 :]
        self.broadcast({"type": "paint", "i": index, "c": color, "n": self.painted})
        return self.painted

    def on_connect(self, socket: ActorSocket[JsonValue, JsonValue, str]) -> None:
        socket.send(self._snapshot())

    def _snapshot(self) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "width": self.width,
            "height": self.height,
            "palette": self.palette,
            "pixels": self.pixels,
            "n": self.painted,
        }
