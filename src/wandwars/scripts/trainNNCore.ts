/**
 * Core NN training primitives — extracted from trainNN.ts so the benchmark
 * script can retrain the network per CV fold without duplicating code.
 *
 * Architecture: hero embeddings (N×EMB_DIM) → team sum → difference →
 * Dense(HIDDEN_DIM) → ReLU → Dense(1) → sigmoid.
 */

import { EMB_DIM, HIDDEN_DIM } from '../prediction/nn'

// Default hyperparameters (can be overridden per run)
export const DEFAULTS = {
  LEARNING_RATE: 0.003,
  WEIGHT_DECAY: 1e-4,
  EPOCHS: 300,
  VALIDATION_SPLIT: 0.15,
  PATIENCE: 30,
  ADAM_BETA1: 0.9,
  ADAM_BETA2: 0.999,
  ADAM_EPS: 1e-8,
}

export interface TrainingSample {
  leftIndices: number[]
  rightIndices: number[]
  target: number // 1 = left wins, 0 = right wins, 0.5 = draw
  weight: number
}

export interface NetworkParams {
  embeddings: Float64Array
  hiddenW: Float64Array
  hiddenB: Float64Array
  outputW: Float64Array
  outputB: Float64Array
}

interface NetworkGrads {
  embeddings: Float64Array
  hiddenW: Float64Array
  hiddenB: Float64Array
  outputW: Float64Array
  outputB: Float64Array
}

interface AdamState {
  m: Float64Array
  v: Float64Array
  t: number
}

// Seeded PRNG (mulberry32) — shared across training runs. The caller should
// call `seedRng()` before each run for reproducibility.
let rngState = 0
export function seedRng(seed: number): void {
  rngState = seed | 0
}
export function random(): number {
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function xavierInit(fanIn: number, fanOut: number): number {
  const limit = Math.sqrt(6 / (fanIn + fanOut))
  return (random() * 2 - 1) * limit
}

export function initParams(numHeroes: number): NetworkParams {
  const embeddings = new Float64Array(numHeroes * EMB_DIM)
  for (let i = 0; i < embeddings.length; i++) embeddings[i] = xavierInit(1, EMB_DIM)
  const hiddenW = new Float64Array(HIDDEN_DIM * EMB_DIM)
  for (let i = 0; i < hiddenW.length; i++) hiddenW[i] = xavierInit(EMB_DIM, HIDDEN_DIM)
  const hiddenB = new Float64Array(HIDDEN_DIM)
  const outputW = new Float64Array(HIDDEN_DIM)
  for (let i = 0; i < outputW.length; i++) outputW[i] = xavierInit(HIDDEN_DIM, 1)
  const outputB = new Float64Array(1)
  return { embeddings, hiddenW, hiddenB, outputW, outputB }
}

function zeroGrads(numHeroes: number): NetworkGrads {
  return {
    embeddings: new Float64Array(numHeroes * EMB_DIM),
    hiddenW: new Float64Array(HIDDEN_DIM * EMB_DIM),
    hiddenB: new Float64Array(HIDDEN_DIM),
    outputW: new Float64Array(HIDDEN_DIM),
    outputB: new Float64Array(1),
  }
}

function createAdamState(size: number): AdamState {
  return { m: new Float64Array(size), v: new Float64Array(size), t: 0 }
}

function sigmoid(x: number): number {
  if (x > 20) return 1
  if (x < -20) return 0
  return 1 / (1 + Math.exp(-x))
}

function forwardAndBackward(
  params: NetworkParams,
  grads: NetworkGrads,
  sample: TrainingSample,
): number {
  const { leftIndices, rightIndices, target, weight } = sample
  const leftEmb = new Float64Array(EMB_DIM)
  const rightEmb = new Float64Array(EMB_DIM)
  for (const idx of leftIndices) {
    const off = idx * EMB_DIM
    for (let i = 0; i < EMB_DIM; i++) leftEmb[i] += params.embeddings[off + i]!
  }
  for (const idx of rightIndices) {
    const off = idx * EMB_DIM
    for (let i = 0; i < EMB_DIM; i++) rightEmb[i] += params.embeddings[off + i]!
  }
  const diff = new Float64Array(EMB_DIM)
  for (let i = 0; i < EMB_DIM; i++) diff[i] = leftEmb[i]! - rightEmb[i]!
  const preRelu = new Float64Array(HIDDEN_DIM)
  const hidden = new Float64Array(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    let sum = params.hiddenB[j]!
    for (let i = 0; i < EMB_DIM; i++) sum += params.hiddenW[j * EMB_DIM + i]! * diff[i]!
    preRelu[j] = sum
    hidden[j] = sum > 0 ? sum : 0
  }
  let logit = params.outputB[0]!
  for (let j = 0; j < HIDDEN_DIM; j++) logit += params.outputW[j]! * hidden[j]!
  const predicted = sigmoid(logit)
  const eps = 1e-7
  const loss =
    -weight * (target * Math.log(predicted + eps) + (1 - target) * Math.log(1 - predicted + eps))
  const dLogit = weight * (predicted - target)
  grads.outputB[0] += dLogit
  const dHidden = new Float64Array(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    grads.outputW[j] += dLogit * hidden[j]!
    dHidden[j] = dLogit * params.outputW[j]!
  }
  const dPreRelu = new Float64Array(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    dPreRelu[j] = preRelu[j]! > 0 ? dHidden[j]! : 0
  }
  const dDiff = new Float64Array(EMB_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    grads.hiddenB[j] += dPreRelu[j]!
    for (let i = 0; i < EMB_DIM; i++) {
      grads.hiddenW[j * EMB_DIM + i] += dPreRelu[j]! * diff[i]!
      dDiff[i] += params.hiddenW[j * EMB_DIM + i]! * dPreRelu[j]!
    }
  }
  for (const idx of leftIndices) {
    const off = idx * EMB_DIM
    for (let i = 0; i < EMB_DIM; i++) grads.embeddings[off + i] += dDiff[i]!
  }
  for (const idx of rightIndices) {
    const off = idx * EMB_DIM
    for (let i = 0; i < EMB_DIM; i++) grads.embeddings[off + i] -= dDiff[i]!
  }
  return loss
}

function adamUpdate(
  params: Float64Array,
  grads: Float64Array,
  state: AdamState,
  lr: number,
  weightDecay: number,
): void {
  state.t++
  const bc1 = 1 - Math.pow(DEFAULTS.ADAM_BETA1, state.t)
  const bc2 = 1 - Math.pow(DEFAULTS.ADAM_BETA2, state.t)
  for (let i = 0; i < params.length; i++) {
    const g = grads[i]! + weightDecay * params[i]!
    state.m[i] = DEFAULTS.ADAM_BETA1 * state.m[i]! + (1 - DEFAULTS.ADAM_BETA1) * g
    state.v[i] = DEFAULTS.ADAM_BETA2 * state.v[i]! + (1 - DEFAULTS.ADAM_BETA2) * g * g
    const mHat = state.m[i]! / bc1
    const vHat = state.v[i]! / bc2
    params[i] -= (lr * mHat) / (Math.sqrt(vHat) + DEFAULTS.ADAM_EPS)
  }
}

export function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

export function computeLoss(
  params: NetworkParams,
  samples: TrainingSample[],
  numHeroes: number,
): number {
  let totalLoss = 0
  const grads = zeroGrads(numHeroes)
  for (const sample of samples) totalLoss += forwardAndBackward(params, grads, sample)
  return samples.length > 0 ? totalLoss / samples.length : 0
}

export function forwardPredict(params: NetworkParams, sample: TrainingSample): number {
  const { leftIndices, rightIndices } = sample
  const leftEmb = new Float64Array(EMB_DIM)
  const rightEmb = new Float64Array(EMB_DIM)
  for (const idx of leftIndices) {
    const off = idx * EMB_DIM
    for (let i = 0; i < EMB_DIM; i++) leftEmb[i] += params.embeddings[off + i]!
  }
  for (const idx of rightIndices) {
    const off = idx * EMB_DIM
    for (let i = 0; i < EMB_DIM; i++) rightEmb[i] += params.embeddings[off + i]!
  }
  const diff = new Float64Array(EMB_DIM)
  for (let i = 0; i < EMB_DIM; i++) diff[i] = leftEmb[i]! - rightEmb[i]!
  const hidden = new Float64Array(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    let sum = params.hiddenB[j]!
    for (let i = 0; i < EMB_DIM; i++) sum += params.hiddenW[j * EMB_DIM + i]! * diff[i]!
    hidden[j] = sum > 0 ? sum : 0
  }
  let logit = params.outputB[0]!
  for (let j = 0; j < HIDDEN_DIM; j++) logit += params.outputW[j]! * hidden[j]!
  return sigmoid(logit)
}

export function computeAccuracy(params: NetworkParams, samples: TrainingSample[]): number {
  let correct = 0
  let total = 0
  for (const sample of samples) {
    if (sample.target === 0.5) continue
    total++
    const pred = forwardPredict(params, sample)
    const predictedWinner = pred >= 0.5 ? 1 : 0
    if (predictedWinner === sample.target) correct++
  }
  return total > 0 ? correct / total : 0
}

export interface RunResult {
  params: NetworkParams
  valAcc: number
  trainAcc: number
  valLoss: number
  epochs: number
  valSamples: TrainingSample[]
  trainSamples: TrainingSample[]
}

export interface TrainOpts {
  seed: number
  verbose?: boolean
  validationSplit?: number
  epochs?: number
  patience?: number
  learningRate?: number
  weightDecay?: number
}

export function trainRun(
  allSamples: TrainingSample[],
  numHeroes: number,
  opts: TrainOpts,
): RunResult {
  const lr = opts.learningRate ?? DEFAULTS.LEARNING_RATE
  const wd = opts.weightDecay ?? DEFAULTS.WEIGHT_DECAY
  const epochs = opts.epochs ?? DEFAULTS.EPOCHS
  const patience = opts.patience ?? DEFAULTS.PATIENCE
  const valSplit = opts.validationSplit ?? DEFAULTS.VALIDATION_SPLIT

  seedRng(opts.seed)

  const samples = [...allSamples]
  shuffle(samples)
  const valSize = Math.round(samples.length * valSplit)
  const valSamples = samples.slice(0, valSize)
  const trainSamples = samples.slice(valSize)

  const params = initParams(numHeroes)
  const adamStates = {
    embeddings: createAdamState(params.embeddings.length),
    hiddenW: createAdamState(params.hiddenW.length),
    hiddenB: createAdamState(params.hiddenB.length),
    outputW: createAdamState(params.outputW.length),
    outputB: createAdamState(params.outputB.length),
  }

  let bestValLoss = Infinity
  let bestParams: NetworkParams | null = null
  let patienceLeft = 0
  let stoppedAt = epochs

  for (let epoch = 0; epoch < epochs; epoch++) {
    shuffle(trainSamples)
    const grads = zeroGrads(numHeroes)
    let epochLoss = 0
    for (const sample of trainSamples) epochLoss += forwardAndBackward(params, grads, sample)
    const n = trainSamples.length || 1
    for (let i = 0; i < grads.embeddings.length; i++) grads.embeddings[i] /= n
    for (let i = 0; i < grads.hiddenW.length; i++) grads.hiddenW[i] /= n
    for (let i = 0; i < grads.hiddenB.length; i++) grads.hiddenB[i] /= n
    for (let i = 0; i < grads.outputW.length; i++) grads.outputW[i] /= n
    for (let i = 0; i < grads.outputB.length; i++) grads.outputB[i] /= n

    adamUpdate(params.embeddings, grads.embeddings, adamStates.embeddings, lr, wd)
    adamUpdate(params.hiddenW, grads.hiddenW, adamStates.hiddenW, lr, wd)
    adamUpdate(params.hiddenB, grads.hiddenB, adamStates.hiddenB, lr, wd)
    adamUpdate(params.outputW, grads.outputW, adamStates.outputW, lr, wd)
    adamUpdate(params.outputB, grads.outputB, adamStates.outputB, lr, wd)

    const valLoss =
      valSamples.length > 0 ? computeLoss(params, valSamples, numHeroes) : epochLoss / n

    if (opts.verbose && ((epoch + 1) % 20 === 0 || epoch === 0)) {
      const trainAcc = computeAccuracy(params, trainSamples)
      const valAcc = computeAccuracy(params, valSamples)
      console.log(
        `  Epoch ${(epoch + 1).toString().padStart(3)}: train_loss=${(epochLoss / n).toFixed(4)} val_loss=${valLoss.toFixed(4)} train_acc=${(trainAcc * 100).toFixed(1)}% val_acc=${(valAcc * 100).toFixed(1)}%`,
      )
    }

    if (valLoss < bestValLoss) {
      bestValLoss = valLoss
      bestParams = {
        embeddings: new Float64Array(params.embeddings),
        hiddenW: new Float64Array(params.hiddenW),
        hiddenB: new Float64Array(params.hiddenB),
        outputW: new Float64Array(params.outputW),
        outputB: new Float64Array(params.outputB),
      }
      patienceLeft = 0
    } else {
      patienceLeft++
      if (patienceLeft >= patience) {
        stoppedAt = epoch + 1
        break
      }
    }
  }

  const final = bestParams || params
  return {
    params: final,
    valAcc: computeAccuracy(final, valSamples),
    trainAcc: computeAccuracy(final, trainSamples),
    valLoss: bestValLoss,
    epochs: stoppedAt,
    valSamples,
    trainSamples,
  }
}

/** Build augmented training samples from MatchResult list (side-swap doubles data). */
export function buildSamples(
  matches: { left: readonly string[]; right: readonly string[]; result: string; weight: number }[],
  heroIndex: Record<string, number>,
): TrainingSample[] {
  const out: TrainingSample[] = []
  for (const match of matches) {
    const leftIdx = match.left.map((h) => heroIndex[h]!).filter((i) => i !== undefined)
    const rightIdx = match.right.map((h) => heroIndex[h]!).filter((i) => i !== undefined)
    if (leftIdx.length !== 3 || rightIdx.length !== 3) continue
    const target = match.result === 'left' ? 1 : match.result === 'right' ? 0 : 0.5
    out.push({ leftIndices: leftIdx, rightIndices: rightIdx, target, weight: match.weight })
    out.push({
      leftIndices: rightIdx,
      rightIndices: leftIdx,
      target: 1 - target,
      weight: match.weight,
    })
  }
  return out
}
