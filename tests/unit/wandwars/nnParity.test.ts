import { describe, expect, it } from 'vitest'

import { EMB_DIM, HIDDEN_DIM, nnForward, type NNWeights } from '@/wandwars/prediction/nn'
import {
  forwardPredict,
  type NetworkParams,
  type TrainingSample,
} from '@/wandwars/scripts/trainNNCore'

// nn.ts (inference) and trainNNCore.ts (training) implement the forward pass
// independently; these tests pin that the two stay numerically identical.
// trainNNCore has no top-level execution, so importing it is side-effect-free.

// Deterministic mixed-sign values so some hidden units land on each side of
// the ReLU and the two teams produce asymmetric activations.
const fill = (n: number, phase: number): number[] =>
  Array.from({ length: n }, (_, i) => (((i * 37 + phase) % 23) - 11) / 16)

const toParams = (w: NNWeights): NetworkParams => ({
  embeddings: Float64Array.from(w.embeddings),
  hiddenW: Float64Array.from(w.hiddenW),
  hiddenB: Float64Array.from(w.hiddenB),
  outputW: Float64Array.from(w.outputW),
  outputB: Float64Array.from([w.outputB]),
})

// target/weight only matter for training; forwardPredict ignores them
const sample = (leftIndices: number[], rightIndices: number[]): TrainingSample => ({
  leftIndices,
  rightIndices,
  target: 1,
  weight: 1,
})

describe('inference/training forward-pass parity', () => {
  const weights: NNWeights = {
    heroIndex: { h0: 0, h1: 1, h2: 2, h3: 3 },
    embeddings: fill(4 * EMB_DIM, 0),
    hiddenW: fill(HIDDEN_DIM * EMB_DIM, 5),
    hiddenB: fill(HIDDEN_DIM, 11),
    outputW: fill(HIDDEN_DIM, 17),
    outputB: 0.125,
  }
  const params = toParams(weights)

  it('agrees across full, swapped, duplicate, partial, and empty teams', () => {
    const cases: [number[], number[]][] = [
      [
        [0, 1, 2],
        [1, 2, 3],
      ],
      [
        [1, 2, 3],
        [0, 1, 2],
      ],
      [
        [3, 0, 1],
        [2, 2, 2],
      ],
      [[0], [3]],
      [[], []], // bias-only path
    ]
    for (const [left, right] of cases) {
      expect(forwardPredict(params, sample(left, right))).toBeCloseTo(
        nnForward(weights, left, right),
        12,
      )
    }
  })

  it('responds to side swap, so parity is not vacuously satisfied by a dead network', () => {
    expect(nnForward(weights, [0, 1, 2], [1, 2, 3])).not.toBe(
      nnForward(weights, [1, 2, 3], [0, 1, 2]),
    )
  })
})

describe('sigmoid saturation parity', () => {
  // Zero weights leave only the output bias; |logit| > 20 must clamp to
  // exactly 0/1 in both implementations.
  const saturated = (outputB: number): NNWeights => ({
    heroIndex: { h0: 0 },
    embeddings: new Array<number>(EMB_DIM).fill(0),
    hiddenW: new Array<number>(HIDDEN_DIM * EMB_DIM).fill(0),
    hiddenB: new Array<number>(HIDDEN_DIM).fill(0),
    outputW: new Array<number>(HIDDEN_DIM).fill(0),
    outputB,
  })

  it('clamps overflow to exact 0 and 1 in both forward passes', () => {
    const high = saturated(25)
    const low = saturated(-25)
    expect(nnForward(high, [0], [0])).toBe(1)
    expect(forwardPredict(toParams(high), sample([0], [0]))).toBe(1)
    expect(nnForward(low, [0], [0])).toBe(0)
    expect(forwardPredict(toParams(low), sample([0], [0]))).toBe(0)
  })
})
