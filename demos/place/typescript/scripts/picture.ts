// Reads a picture of the demo: an SVG of one-pixel runs on a canvas of 368 by 89 pixels, such as the file in
// pictures/. Each path has a translation, a whole scale and one fill color.
import { readFileSync } from "node:fs"

export const WIDTH = 368
export const HEIGHT = 89

export interface Picture {
    /** Hex colors: the background first, then the other colors of the picture. */
    palette: string[]
    /** The palette index of each pixel, row by row. */
    colors: Uint8Array
}

export function loadPicture(file: string, background = "f0eef3"): Picture {
    const svg = readFileSync(file, "utf8")
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
    if (!box || Number(box[1]) !== WIDTH || Number(box[2]) !== HEIGHT) {
        throw new Error(`${file} needs viewBox="0 0 ${WIDTH} ${HEIGHT}"`)
    }
    const pixels = new Map<number, string>()
    const paths = /<path transform="translate\((\d+) (\d+)\) scale\((\d+)\)" d="([^"]+)" fill="#([0-9a-f]{6})"\/>/g
    for (const [, tx, ty, factor, d, color] of svg.matchAll(paths)) {
        const scale = Number(factor)
        for (const [, x, y, run] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
            for (let px = Number(tx) + Number(x) * scale; px < Number(tx) + (Number(x) + Number(run)) * scale; px++) {
                for (let py = Number(ty) + Number(y) * scale; py < Number(ty) + (Number(y) + 1) * scale; py++) {
                    if (px < WIDTH && py < HEIGHT) pixels.set(py * WIDTH + px, color)
                }
            }
        }
    }
    const palette = [background, ...[...new Set(pixels.values())].filter(color => color !== background).sort()]
    // The actor stores a color as one base-36 digit, and 0 means "not painted".
    if (palette.length > 35) throw new Error(`${file} has ${palette.length} colors, and the actor takes at most 35`)
    const colors = new Uint8Array(WIDTH * HEIGHT)
    for (const [at, color] of pixels) colors[at] = palette.indexOf(color)
    return { palette, colors }
}
