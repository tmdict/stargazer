/* A comb: `n` columns of cards with gutters between them, fitted to a profile of
 * how much of each pixel column is ground. The roster reader fits one of six to the
 * grid and one of five to the Hands of Resonance. */

export interface Comb {
  // The first gutter's centre and the column pitch: column k spans
  // phase + k * pitch to phase + (k + 1) * pitch, its card in the middle.
  phase: number
  pitch: number
  // The cards' width: the pitch less the gutter.
  card: number
  score: number
  // The rows of the slabs that agreed with it, when fitted slab by slab.
  rows?: [number, number]
}

/* `n` columns of cards with gutters between them, fitted to a column profile: the
 * gutters as ground as possible, the cards' middles as little. The gutters at the
 * two ends count only where they are in the shot, since a crop can cut them. */
export function fitComb(
  profile: Float32Array,
  n: number,
  pitchRange: readonly [number, number],
  pitchStep = 0.25,
  phaseStep = 0.5,
): Comb | null {
  const W = profile.length
  // A gutter is sampled at its best pixel within one either side; a card's middle
  // over its central fifth.
  const gutterAt = (x: number): number => {
    const i = Math.round(x)
    return Math.max(profile[i - 1] ?? 0, profile[i] ?? 0, profile[i + 1] ?? 0)
  }
  const middleAt = (x: number, pitch: number): number => {
    const r = Math.max(1, Math.round(pitch * 0.1))
    let sum = 0
    let k = 0
    for (let i = Math.round(x) - r; i <= Math.round(x) + r; i++) {
      if (i < 0 || i >= W) continue
      sum += profile[i]!
      k++
    }
    return k ? sum / k : 1
  }
  let best: Comb | null = null
  for (let pitch = pitchRange[0]; pitch <= pitchRange[1]; pitch += pitchStep) {
    for (let phase = -pitch / 2; phase + n * pitch <= W + pitch / 2; phase += phaseStep) {
      if (phase + pitch < 0 || phase + (n - 1) * pitch > W) continue
      let g = 0
      let gn = 0
      for (let k = 0; k <= n; k++) {
        const x = phase + k * pitch
        if (x < 0 || x > W - 1) continue
        g += gutterAt(x)
        gn++
      }
      let c = 0
      for (let k = 0; k < n; k++) c += middleAt(phase + (k + 0.5) * pitch, pitch)
      const score = g / gn - c / n
      if (!best || score > best.score) best = { phase, pitch, card: 0, score }
    }
  }
  if (!best) return null
  // The gutter's width: around each inner gutter, the run of the profile above half
  // way between the gutter's peak and the cards' middles.
  const widths: number[] = []
  for (let k = 1; k < n; k++) {
    const g = best.phase + k * best.pitch
    const peak = gutterAt(g)
    const floor = Math.min(
      middleAt(g - best.pitch / 2, best.pitch),
      middleAt(g + best.pitch / 2, best.pitch),
    )
    const half = (peak + floor) / 2
    let a = Math.round(g)
    let b = Math.round(g)
    while (a > 0 && profile[a - 1]! >= half && g - a < best.pitch / 2) a--
    while (b < W - 1 && profile[b + 1]! >= half && b - g < best.pitch / 2) b++
    widths.push(b - a + 1)
  }
  return { ...best, card: best.pitch - median(widths) }
}

export const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length === 0 ? NaN : s[Math.floor(s.length / 2)]!
}
