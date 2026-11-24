/**
 * Original pixel/voxel motif: a candle wick inside a lens ring, built from
 * isometric cubes. Used on the product page and the host panel; no external
 * illustration asset, no copied geometry.
 */

interface Voxel {
  x: number
  y: number
  z: number
  tone: number
}

const TONES = [
  { top: '#8dffb8', left: '#46e08a', right: '#2b7d52' },
  { top: '#46e08a', left: '#2b7d52', right: '#1d5a39' },
  { top: '#2b7d52', left: '#1d5a39', right: '#123a27' },
] as const

export function voxelLensSvg(size = 520): string {
  const voxels: Voxel[] = []
  const add = (x: number, y: number, z: number, tone: number) => voxels.push({ x, y, z, tone })

  // Lens ring: a thick, pixelated band of cubes. The front half stays bright;
  // the back half drops into shadow for isometric depth.
  for (let x = -11; x <= 11; x++) {
    for (let y = -11; y <= 11; y++) {
      const r = Math.hypot(x, y)
      if (r >= 6.6 && r <= 9.6) {
        const front = x + y >= 0
        const tone = front
          ? (Math.abs(x * 7 + y * 3) % 7 === 0 ? 2 : 0)
          : (Math.abs(x * 5 + y * 7) % 5 === 0 ? 2 : 1)
        add(x, y, 0, tone)
      }
    }
  }

  // Candle body: six cubes tall, then a bright wick.
  for (let z = 0; z < 6; z++) add(0, 2, z, 0)

  // A few floating cubes for depth, like dust in the lens.
  add(-12, 4, 0, 2)
  add(11, -7, 0, 2)
  add(-10, -9, 0, 2)
  add(12, 3, 0, 2)
  add(-11, 8, 1, 2)

  const iso = (x: number, y: number, z: number) => ({
    px: (x - y) * 18,
    py: (x + y) * 9 - z * 14,
  })

  const cube = (v: Voxel): string => {
    const { px, py } = iso(v.x, v.y, v.z)
    const c = TONES[v.tone]
    return (
      `<path d="M${px} ${py - 14} L${px + 18} ${py - 5} L${px} ${py + 4} L${px - 18} ${py - 5} Z" fill="${c.top}"/>` +
      `<path d="M${px - 18} ${py - 5} L${px} ${py + 4} L${px} ${py + 22} L${px - 18} ${py + 13} Z" fill="${c.left}"/>` +
      `<path d="M${px + 18} ${py - 5} L${px} ${py + 4} L${px} ${py + 22} L${px + 18} ${py + 13} Z" fill="${c.right}"/>`
    )
  }

  // Back to front: isometric depth is x + y, then height.
  const sorted = [...voxels].sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z)
  const top = iso(0, 2, 5)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-390 -260 780 520" fill="none" role="presentation" aria-hidden="true">
  <g>${sorted.map(cube).join('')}</g>
  <line x1="${top.px}" y1="${top.py - 14}" x2="${top.px}" y2="${top.py - 52}" stroke="#8dffb8" stroke-width="5" stroke-linecap="round"/>
  <line x1="${top.px}" y1="${top.py - 52}" x2="${top.px}" y2="${top.py - 74}" stroke="#8dffb8" stroke-width="2.6" stroke-linecap="round" opacity="0.65"/>
</svg>`
}
