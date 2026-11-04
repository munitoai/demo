import { Actor, Ephemeral, type ActorSocket } from "terse-sdk/actor"

/** One paint: the time in seconds when the actor took it, the pixel, and its palette index. */
export type Paint = [number, number, number]
/** To a viewer: the whole picture when it connects, then each paint. */
export type Frame = { picture: string } | Paint

/** The canvas of the demo, 368 by 89 pixels. */
const PIXELS = 368 * 89

/**
 * One share of the picture. Each sandbox calls `paint` once to set its pixel, and each viewer sees the paint at once.
 * The picture is one base-36 digit for each pixel: 0 is not painted, and color k is k + 1. It lives in memory only,
 * so a restart of the actor clears it.
 */
export class Grid extends Actor<{ viewer?: string }, never, Frame> {
    @Ephemeral private pixels: number[] = new Array<number>(PIXELS).fill(0)

    async paint(pixel: number, color: number): Promise<void> {
        const known = Number.isInteger(pixel) && pixel >= 0 && pixel < PIXELS
        if (!known || !Number.isInteger(color) || color < 0 || color > 34) {
            throw new Error("a paint needs a pixel of the canvas and a color from 0 to 34")
        }
        this.pixels[pixel] = color + 1
        this.broadcast([Date.now() / 1000, pixel, color])
    }

    async picture(): Promise<string> {
        return encode(this.pixels)
    }

    async onConnect(socket: ActorSocket<{ viewer?: string }, Frame>): Promise<void> {
        socket.send({ picture: encode(this.pixels) })
    }
}

function encode(pixels: number[]): string {
    return pixels.map(value => value.toString(36)).join("")
}
