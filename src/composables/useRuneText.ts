/* Draws the letters under an element as rune shapes (runeText), leaving every
   node Vue made where Vue put it: a text node is emptied and a span of shapes
   goes in front of it, so Vue's later updates still find their nodes. A
   MutationObserver redraws a text Vue changes and drops the shapes of one it
   removes or empties. Text inside an SVG stays as it is, since an SVG text
   element cannot hold the shapes. */

import { onBeforeUnmount, onMounted, type Ref } from 'vue'

import { runeRuns } from '@/utils/runeText'

const SVG_NS = 'http://www.w3.org/2000/svg'

// About a capital letter's height.
const GLYPH_HEIGHT_EM = 0.68

const LETTER = /\p{L}/u

const drawRuns = (text: string): HTMLSpanElement => {
  const span = document.createElement('span')
  span.className = 'rune-text'
  for (const run of runeRuns(text)) {
    if (typeof run === 'string') {
      span.append(run)
      continue
    }
    const word = document.createElement('span')
    word.className = 'rune-word'
    for (const piece of run) {
      if (typeof piece === 'string') {
        word.append(piece)
        continue
      }
      const [width, d] = piece
      const svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('viewBox', `0 0 ${width} 10`)
      svg.setAttribute('width', `${((width / 10) * GLYPH_HEIGHT_EM).toFixed(3)}em`)
      svg.setAttribute('height', `${GLYPH_HEIGHT_EM}em`)
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', d)
      path.setAttribute('fill-rule', 'evenodd')
      svg.append(path)
      word.append(svg)
    }
    span.append(word)
  }
  return span
}

export function useRuneText(root: Readonly<Ref<HTMLElement | null | undefined>>): void {
  const drawn = new Map<Text, HTMLSpanElement>()
  let observer: MutationObserver | null = null

  const draw = (node: Text): void => {
    const span = drawRuns(node.data)
    drawn.get(node)?.remove()
    node.before(span)
    drawn.set(node, span)
    node.data = ''
  }

  const forget = (node: Text): void => {
    drawn.get(node)?.remove()
    drawn.delete(node)
  }

  const sync = (el: HTMLElement, records: readonly MutationRecord[] = []): void => {
    // Each edited node is judged once, by its final text, since Vue may write
    // to it more than once before the records arrive. Only Vue writes into a
    // node already emptied here (old value ''), so a node left empty after
    // such a write is one Vue emptied.
    const edited = new Map<Text, boolean>()
    for (const record of records) {
      const node = record.target
      if (record.type !== 'characterData' || !(node instanceof Text) || !drawn.has(node)) continue
      edited.set(node, edited.get(node) === true || record.oldValue === '')
    }
    for (const [node, writtenByVue] of edited) {
      if (node.data !== '') draw(node)
      else if (writtenByVue) forget(node)
    }
    for (const [node, span] of drawn) {
      if (!el.contains(node)) forget(node)
      else if (span.nextSibling !== node) node.before(span)
    }
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const fresh: Text[] = []
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      if (drawn.has(node) || !LETTER.test(node.data)) continue
      if (node.parentElement?.closest('svg, .rune-text')) continue
      fresh.push(node)
    }
    fresh.forEach(draw)
  }

  onMounted(() => {
    const el = root.value
    if (!el) return
    sync(el)
    observer = new MutationObserver((records) => sync(el, records))
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
    })
  })

  onBeforeUnmount(() => observer?.disconnect())
}
