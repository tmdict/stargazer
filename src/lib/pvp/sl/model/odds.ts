/* The chance of winning each number of games, each game won or lost on its
 * own: the generator's boards and Who Would Win?'s five games. */

// Written in place, since the generator's search asks for it at every step.
export function oddsInto(chances: ArrayLike<number>, odds: Float64Array): Float64Array {
  odds.fill(0)
  odds[0] = 1
  for (let i = 0; i < chances.length; i++) {
    const p = chances[i]!
    for (let k = i + 1; k > 0; k--) odds[k] = odds[k - 1]! * p + odds[k]! * (1 - p)
    odds[0] = odds[0]! * (1 - p)
  }
  return odds
}
