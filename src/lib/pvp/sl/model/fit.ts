/* Penalised logistic regression: the numbers that best explain who won each
 * game, each held toward zero by its own amount (lambda), so a number moves
 * only as far as the games push it. Minimised by L-BFGS, which needs only the
 * loss and its slope and starts from zero, so the same games always give the
 * same numbers. */

export const sigmoid = (x: number): number =>
  x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x))

// A row's nonzero features as [index, value].
export type Row = [index: number, value: number][]

interface Penalised {
  loss: number
  slope: Float64Array
}

function penalisedLoss(
  rows: readonly Row[],
  won: readonly boolean[],
  lambdas: readonly number[],
  w: Float64Array,
): Penalised {
  let loss = 0
  const slope = new Float64Array(w.length)
  rows.forEach((row, i) => {
    let z = 0
    for (const [j, v] of row) z += w[j]! * v
    const p = sigmoid(z)
    loss -= Math.log(Math.max(won[i] ? p : 1 - p, 1e-15))
    const r = p - (won[i] ? 1 : 0)
    for (const [j, v] of row) slope[j]! += r * v
  })
  lambdas.forEach((lambda, j) => {
    loss += 0.5 * lambda * w[j]! * w[j]!
    slope[j]! += lambda * w[j]!
  })
  return { loss, slope }
}

const dot = (a: Float64Array, b: Float64Array): number => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}

const MEMORY = 12
const MAX_STEPS = 300

export function fit(
  rows: readonly Row[],
  won: readonly boolean[],
  lambdas: readonly number[],
): Float64Array {
  const n = lambdas.length
  let w = new Float64Array(n)
  let { loss, slope } = penalisedLoss(rows, won, lambdas, w)
  const S: Float64Array[] = []
  const Y: Float64Array[] = []
  for (let step = 0; step < MAX_STEPS; step++) {
    // The two-loop recursion: the slope turned by the recent steps' curvature.
    const q = Float64Array.from(slope)
    const alphas: number[] = []
    for (let k = S.length - 1; k >= 0; k--) {
      const a = dot(S[k]!, q) / dot(Y[k]!, S[k]!)
      alphas.push(a)
      for (let j = 0; j < n; j++) q[j]! -= a * Y[k]![j]!
    }
    if (S.length) {
      const k = S.length - 1
      const gamma = dot(S[k]!, Y[k]!) / dot(Y[k]!, Y[k]!)
      for (let j = 0; j < n; j++) q[j]! *= gamma
    }
    for (let k = 0; k < S.length; k++) {
      const b = dot(Y[k]!, q) / dot(Y[k]!, S[k]!)
      const a = alphas[S.length - 1 - k]!
      for (let j = 0; j < n; j++) q[j]! += (a - b) * S[k]![j]!
    }
    const direction = q.map((v) => -v)
    const descent = dot(slope, direction)
    // Halve the step until the loss falls enough (Armijo).
    let length = 1
    let next = w
    let at = { loss, slope }
    for (let tries = 0; tries < 30; tries++) {
      next = w.map((v, j) => v + length * direction[j]!)
      at = penalisedLoss(rows, won, lambdas, next)
      if (at.loss <= loss + 1e-4 * length * descent) break
      length /= 2
    }
    const s = next.map((v, j) => v - w[j]!)
    const y = at.slope.map((v, j) => v - slope[j]!)
    if (dot(s, y) > 1e-12) {
      S.push(s)
      Y.push(y)
      if (S.length > MEMORY) {
        S.shift()
        Y.shift()
      }
    }
    const done = Math.abs(loss - at.loss) < 1e-9 * Math.max(1, Math.abs(loss))
    w = next
    loss = at.loss
    slope = at.slope
    if (done) break
  }
  return w
}
