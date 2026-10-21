/**
 * An element's text as the page shows it: an armed ConfirmLabel keeps its
 * label in the DOM under "Confirm" for the button's width, so plain textContent
 * reads both.
 */
export const shownText = (el: Element): string => {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('.confirm-label > .hidden').forEach((hidden) => hidden.remove())
  return copy.textContent?.trim() ?? ''
}
