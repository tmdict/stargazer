/**
 * Train the Adaptive ML neural network and export weights.
 *
 * Usage: npm run train:ww
 *
 * Architecture: hero embeddings (87×16) → team sum → difference → Dense(16) → ReLU → Dense(1) → sigmoid
 * ~1,700 parameters. Trains on raw match data with side-swap augmentation.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { EMB_DIM, HIDDEN_DIM } from '../prediction/nn'
import { getUniqueHeroes, parseMatchData } from '../records/parser'

// Training hyperparameters
const LEARNING_RATE = 0.003
const WEIGHT_DECAY = 1e-4
const EPOCHS = 300
const VALIDATION_SPLIT = 0.15
const PATIENCE = 30
const ADAM_BETA1 = 0.9
const ADAM_BETA2 = 0.999
const ADAM_EPS = 1e-8

// Xavier initialization
function xavierInit(fanIn: number, fanOut: number): number {
  const limit = Math.sqrt(6 / (fanIn + fanOut))
  return (Math.random() * 2 - 1) * limit
}

interface TrainingSample {
  leftIndices: number[]
  rightIndices: number[]
  target: number // 1 = left wins, 0 = right wins, 0.5 = draw
  weight: number
}

interface AdamState {
  m: Float64Array
  v: Float64Array
  t: number
}

function createAdamState(size: number): AdamState {
  return { m: new Float64Array(size), v: new Float64Array(size), t: 0 }
}

// All trainable parameters packed into flat arrays for Adam
interface NetworkParams {
  embeddings: Float64Array // [numHeroes * EMB_DIM]
  hiddenW: Float64Array // [HIDDEN_DIM * EMB_DIM]
  hiddenB: Float64Array // [HIDDEN_DIM]
  outputW: Float64Array // [HIDDEN_DIM]
  outputB: Float64Array // [1]
}

interface NetworkGrads {
  embeddings: Float64Array
  hiddenW: Float64Array
  hiddenB: Float64Array
  outputW: Float64Array
  outputB: Float64Array
}

function initParams(numHeroes: number): NetworkParams {
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

  // Forward: sum embeddings
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

  // Difference
  const diff = new Float64Array(EMB_DIM)
  for (let i = 0; i < EMB_DIM; i++) diff[i] = leftEmb[i]! - rightEmb[i]!

  // Hidden layer: ReLU(W * diff + b)
  const preRelu = new Float64Array(HIDDEN_DIM)
  const hidden = new Float64Array(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    let sum = params.hiddenB[j]!
    for (let i = 0; i < EMB_DIM; i++) sum += params.hiddenW[j * EMB_DIM + i]! * diff[i]!
    preRelu[j] = sum
    hidden[j] = sum > 0 ? sum : 0
  }

  // Output: sigmoid(w · hidden + b)
  let logit = params.outputB[0]!
  for (let j = 0; j < HIDDEN_DIM; j++) logit += params.outputW[j]! * hidden[j]!
  const predicted = sigmoid(logit)

  // BCE loss (weighted)
  const eps = 1e-7
  const loss =
    -weight * (target * Math.log(predicted + eps) + (1 - target) * Math.log(1 - predicted + eps))

  // Backward: dL/dlogit = weight * (predicted - target)
  const dLogit = weight * (predicted - target)

  // Output layer grads
  grads.outputB[0] += dLogit
  const dHidden = new Float64Array(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    grads.outputW[j] += dLogit * hidden[j]!
    dHidden[j] = dLogit * params.outputW[j]!
  }

  // ReLU backward
  const dPreRelu = new Float64Array(HIDDEN_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    dPreRelu[j] = preRelu[j]! > 0 ? dHidden[j]! : 0
  }

  // Hidden layer grads
  const dDiff = new Float64Array(EMB_DIM)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    grads.hiddenB[j] += dPreRelu[j]!
    for (let i = 0; i < EMB_DIM; i++) {
      grads.hiddenW[j * EMB_DIM + i] += dPreRelu[j]! * diff[i]!
      dDiff[i] += params.hiddenW[j * EMB_DIM + i]! * dPreRelu[j]!
    }
  }

  // Embedding grads
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

function adamUpdate(params: Float64Array, grads: Float64Array, state: AdamState, lr: number): void {
  state.t++
  const bc1 = 1 - Math.pow(ADAM_BETA1, state.t)
  const bc2 = 1 - Math.pow(ADAM_BETA2, state.t)
  for (let i = 0; i < params.length; i++) {
    const g = grads[i]! + WEIGHT_DECAY * params[i]!
    state.m[i] = ADAM_BETA1 * state.m[i]! + (1 - ADAM_BETA1) * g
    state.v[i] = ADAM_BETA2 * state.v[i]! + (1 - ADAM_BETA2) * g * g
    const mHat = state.m[i]! / bc1
    const vHat = state.v[i]! / bc2
    params[i] -= (lr * mHat) / (Math.sqrt(vHat) + ADAM_EPS)
  }
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

function computeLoss(params: NetworkParams, samples: TrainingSample[], numHeroes: number): number {
  let totalLoss = 0
  const grads = zeroGrads(numHeroes) // throwaway grads
  for (const sample of samples) {
    totalLoss += forwardAndBackward(params, grads, sample)
  }
  return totalLoss / samples.length
}

function computeAccuracy(params: NetworkParams, samples: TrainingSample[]): number {
  let correct = 0
  const total = samples.filter((s) => s.target !== 0.5).length
  for (const sample of samples) {
    if (sample.target === 0.5) continue
    const leftEmb = new Float64Array(EMB_DIM)
    const rightEmb = new Float64Array(EMB_DIM)
    for (const idx of sample.leftIndices) {
      const off = idx * EMB_DIM
      for (let i = 0; i < EMB_DIM; i++) leftEmb[i] += params.embeddings[off + i]!
    }
    for (const idx of sample.rightIndices) {
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
    const pred = sigmoid(logit)
    const predictedWinner = pred >= 0.5 ? 1 : 0
    if (predictedWinner === sample.target) correct++
  }
  return total > 0 ? correct / total : 0
}

// ---- Main ----

const rawDir = join(import.meta.dirname!, '..', 'data', 'raw')
const dataFiles = readdirSync(rawDir).filter((f) => f.endsWith('.data'))
let allRaw = ''
for (const f of dataFiles) {
  allRaw += readFileSync(join(rawDir, f), 'utf-8') + '\n'
}

const matches = parseMatchData(allRaw)
const heroes = getUniqueHeroes(matches)
const heroIndex: Record<string, number> = {}
heroes.forEach((h, i) => (heroIndex[h] = i))
const numHeroes = heroes.length

console.log(`Heroes: ${numHeroes}, Matches: ${matches.length}`)

// Build training samples with side-swap augmentation
const allSamples: TrainingSample[] = []
for (const match of matches) {
  const leftIdx = match.left.map((h) => heroIndex[h]!).filter((i) => i !== undefined)
  const rightIdx = match.right.map((h) => heroIndex[h]!).filter((i) => i !== undefined)
  if (leftIdx.length !== 3 || rightIdx.length !== 3) continue

  const target = match.result === 'left' ? 1 : match.result === 'right' ? 0 : 0.5

  // Original
  allSamples.push({ leftIndices: leftIdx, rightIndices: rightIdx, target, weight: match.weight })
  // Side-swapped augmentation
  allSamples.push({
    leftIndices: rightIdx,
    rightIndices: leftIdx,
    target: 1 - target,
    weight: match.weight,
  })
}

// Split into train/validation
shuffle(allSamples)
const valSize = Math.round(allSamples.length * VALIDATION_SPLIT)
const valSamples = allSamples.slice(0, valSize)
const trainSamples = allSamples.slice(valSize)

console.log(`Training: ${trainSamples.length}, Validation: ${valSamples.length}`)

// Initialize
const params = initParams(numHeroes)
const adamStates = {
  embeddings: createAdamState(params.embeddings.length),
  hiddenW: createAdamState(params.hiddenW.length),
  hiddenB: createAdamState(params.hiddenB.length),
  outputW: createAdamState(params.outputW.length),
  outputB: createAdamState(params.outputB.length),
}

// Training loop
let bestValLoss = Infinity
let bestParams: NetworkParams | null = null
let patience = 0

for (let epoch = 0; epoch < EPOCHS; epoch++) {
  shuffle(trainSamples)
  const grads = zeroGrads(numHeroes)
  let epochLoss = 0

  for (const sample of trainSamples) {
    epochLoss += forwardAndBackward(params, grads, sample)
  }

  // Scale gradients by batch size
  const n = trainSamples.length
  for (let i = 0; i < grads.embeddings.length; i++) grads.embeddings[i] /= n
  for (let i = 0; i < grads.hiddenW.length; i++) grads.hiddenW[i] /= n
  for (let i = 0; i < grads.hiddenB.length; i++) grads.hiddenB[i] /= n
  for (let i = 0; i < grads.outputW.length; i++) grads.outputW[i] /= n
  for (let i = 0; i < grads.outputB.length; i++) grads.outputB[i] /= n

  // Adam updates
  adamUpdate(params.embeddings, grads.embeddings, adamStates.embeddings, LEARNING_RATE)
  adamUpdate(params.hiddenW, grads.hiddenW, adamStates.hiddenW, LEARNING_RATE)
  adamUpdate(params.hiddenB, grads.hiddenB, adamStates.hiddenB, LEARNING_RATE)
  adamUpdate(params.outputW, grads.outputW, adamStates.outputW, LEARNING_RATE)
  adamUpdate(params.outputB, grads.outputB, adamStates.outputB, LEARNING_RATE)

  // Validation
  const valLoss = computeLoss(params, valSamples, numHeroes)
  const trainAcc = computeAccuracy(params, trainSamples)
  const valAcc = computeAccuracy(params, valSamples)

  if ((epoch + 1) % 20 === 0 || epoch === 0) {
    console.log(
      `Epoch ${(epoch + 1).toString().padStart(3)}: train_loss=${(epochLoss / n).toFixed(4)} val_loss=${valLoss.toFixed(4)} train_acc=${(trainAcc * 100).toFixed(1)}% val_acc=${(valAcc * 100).toFixed(1)}%`,
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
    patience = 0
  } else {
    patience++
    if (patience >= PATIENCE) {
      console.log(`Early stopping at epoch ${epoch + 1}`)
      break
    }
  }
}

// Use best params
const final = bestParams || params
const finalValAcc = computeAccuracy(final, valSamples)
const finalTrainAcc = computeAccuracy(final, trainSamples)
console.log(
  `\nFinal: train_acc=${(finalTrainAcc * 100).toFixed(1)}% val_acc=${(finalValAcc * 100).toFixed(1)}%`,
)

// Export weights
const round = (x: number) => Math.round(x * 1e6) / 1e6
const weightsObj = {
  heroIndex,
  embeddings: Array.from(final.embeddings).map(round),
  hiddenW: Array.from(final.hiddenW).map(round),
  hiddenB: Array.from(final.hiddenB).map(round),
  outputW: Array.from(final.outputW).map(round),
  outputB: round(final.outputB[0]!),
}

const outPath = join(import.meta.dirname!, '..', 'prediction', 'nnWeights.ts')
const content = `// Auto-generated by trainNN.ts — do not edit manually\nimport type { NNWeights } from './nn'\n\nexport const NN_WEIGHTS: NNWeights = ${JSON.stringify(weightsObj)}\n`
writeFileSync(outPath, content)
console.log(`Weights written to ${outPath}`)
