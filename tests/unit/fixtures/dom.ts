/**
 * An element's text as the page shows it: a ConfirmLabel keeps its other label
 * in the DOM for the button's width, so plain textContent reads both.
 */
export const shownText = (el: Element): string => {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('.confirm-label > .hidden').forEach((hidden) => hidden.remove())
  return copy.textContent?.trim() ?? ''
}
