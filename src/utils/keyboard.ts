// A key pressed while an input method composes text (Chinese, Korean,
// Japanese) belongs to the composition: Enter confirms it, Esc drops it and
// the arrows pick a candidate. keyCode 229 covers browsers that omit
// isComposing.
export const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing || event.keyCode === 229
