/**
 * Neural network forward pass for the Adaptive ML model.
 * Tiny embedding-based architecture: hero embeddings → team sum → difference → hidden → sigmoid.
 */

export const EMB_DIM = 16
export const HIDDEN_DIM = 16

export interface NNWeights {
  heroIndex: Record<string, number>
  embeddings: number[] // flat [numHeroes × EMB_DIM]
  hiddenW: number[] // flat [EMB_DIM × HIDDEN_DIM]
  hiddenB: number[] // [HIDDEN_DIM]
  outputW: number[] // [HIDDEN_DIM]
  outputB: number
}

function getEmbedding(weights: NNWeights, heroIdx: number): number[] {
  const start = heroIdx * EMB_DIM
  return weights.embeddings.slice(start, start + EMB_DIM)
}

function sumEmbeddings(weights: NNWeights, heroIndices: number[]): number[] {
  const result = new Array<number>(EMB_DIM).fill(0)
  for (const idx of heroIndices) {
    const emb = getEmbedding(weights, idx)
    for (let i = 0; i < EMB_DIM; i++) result[i] += emb[i]!
  }
  return result
}

function relu(x: number): number {
  return x > 0 ? x : 0
}

function sigmoid(x: number): number {
  if (x > 20) return 1
  if (x < -20) return 0
  return 1 / (1 + Math.exp(-x))
}

/**
 * Forward pass: predict P(left wins) given hero index arrays.
 */
export function nnForward(
  weights: NNWeights,
  leftIndices: number[],
  rightIndices: number[],
): number {
  const leftEmb = sumEmbeddings(weights, leftIndices)
  const rightEmb = sumEmbeddings(weights, rightIndices)

  // Difference: left - right
  const diff = new Array<number>(EMB_DIM)
  for (let i = 0; i < EMB_DIM; i++) diff[i] = leftEmb[i]! - rightEmb[i]!

  // Hidden layer: ReLU(W * diff + b)
  const hidden = new Array<number>(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    let sum = weights.hiddenB[j]!
    for (let i = 0; i < EMB_DIM; i++) {
      sum += weights.hiddenW[j * EMB_DIM + i]! * diff[i]!
    }
    hidden[j] = relu(sum)
  }

  // Output: sigmoid(w · hidden + b)
  let out = weights.outputB
  for (let j = 0; j < HIDDEN_DIM; j++) {
    out += weights.outputW[j]! * hidden[j]!
  }

  return sigmoid(out)
}

/**
 * Compute the mean hero embedding across all heroes (for unknown opponents baseline).
 */
export function meanEmbedding(weights: NNWeights): number[] {
  const numHeroes = Object.keys(weights.heroIndex).length
  const result = new Array<number>(EMB_DIM).fill(0)
  for (let h = 0; h < numHeroes; h++) {
    const emb = getEmbedding(weights, h)
    for (let i = 0; i < EMB_DIM; i++) result[i] += emb[i]!
  }
  for (let i = 0; i < EMB_DIM; i++) result[i] /= numHeroes
  return result
}

/**
 * Resolve hero names to index array. Unknown heroes get -1.
 */
export function heroNamesToIndices(names: string[], heroIndex: Record<string, number>): number[] {
  return names.map((n) => heroIndex[n] ?? -1).filter((i) => i >= 0)
}
