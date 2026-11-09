/* Dragging on the lists page, by pointer events rather than HTML drag and
 * drop so touch works too: a mouse drags a card from anywhere on it, a finger
 * only by its grip, so the page still scrolls under a finger. A hero from the
 * Add heroes panel drops into the list at the marker; a card dropped on the
 * panel leaves the list. The page marks its parts with `data-drag` (grid,
 * wrap, pool), each card with `data-index` and each panel hero with
 * `data-hero`. */

import { inject, onBeforeUnmount, provide, ref, type InjectionKey, type Ref } from 'vue'

import { viewportHeight } from '@/utils/viewport'
import type { ListEditor } from './useListEditor'

interface Drag {
  from: 'list' | 'pool'
  index: number
  hero: number
  el: HTMLElement
  x0: number
  y0: number
  dx: number
  dy: number
  started: boolean
  target: number | 'remove' | null
  ghost?: HTMLElement
  speed: number
}

export interface DragMarker {
  left: number
  top: number
  width: number
}

const EDGE = 70
// The sticky toolbar covers the top of the window.
const TOP_EDGE = EDGE + 60

const inside = (rect: DOMRect, x: number, y: number, pad = 0): boolean =>
  x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad

export function useListDrag(root: Ref<HTMLElement | null>, editor: ListEditor) {
  const marker = ref<DragMarker | null>(null)
  const removing = ref(false)
  const lifted = ref<number | null>(null)
  let drag: Drag | null = null
  let pointer = { x: 0, y: 0 }
  let frame = 0

  const part = (name: string): HTMLElement | null =>
    root.value?.querySelector<HTMLElement>(`[data-drag="${name}"]`) ?? null
  const cards = (): HTMLElement[] => [
    ...(part('grid')?.querySelectorAll<HTMLElement>(':scope > [data-index]') ?? []),
  ]

  function onDown(event: PointerEvent): void {
    if (event.button !== 0 || drag) return
    const target = event.target as HTMLElement
    const card = target.closest<HTMLElement>('[data-drag="grid"] > [data-index]')
    const hero = target.closest<HTMLElement>('[data-drag="pool"] [data-hero]')
    if (!card && !hero) return
    if (card && target.closest('button:not([data-rank]), input, a, [data-no-drag]')) return
    const touch = event.pointerType !== 'mouse'
    if (touch && (hero || !target.closest('[data-grip]'))) return
    drag = {
      from: card ? 'list' : 'pool',
      index: card ? Number(card.dataset.index) : -1,
      hero: hero ? Number(hero.dataset.hero) : -1,
      el: (card ?? hero)!,
      x0: event.clientX,
      y0: event.clientY,
      dx: 0,
      dy: 0,
      started: false,
      target: null,
      speed: 0,
    }
    if (touch) event.preventDefault()
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('keydown', onKey)
  }

  function start(current: Drag): void {
    current.started = true
    const rect = current.el.getBoundingClientRect()
    current.dx = Math.min(current.x0 - rect.left, 300)
    current.dy = current.y0 - rect.top
    const ghost = current.el.cloneNode(true) as HTMLElement
    ghost.classList.add('lists-ghost')
    ghost.style.width = `${Math.min(rect.width, 320)}px`
    document.body.appendChild(ghost)
    current.ghost = ghost
    if (current.from === 'list') lifted.value = current.index
    document.body.classList.add('lists-dragging')
  }

  function onMove(event: PointerEvent): void {
    if (!drag) return
    pointer = { x: event.clientX, y: event.clientY }
    if (!drag.started) {
      if (Math.hypot(pointer.x - drag.x0, pointer.y - drag.y0) < 5) return
      start(drag)
    }
    event.preventDefault()
    drag.ghost!.style.transform = `translate(${pointer.x - drag.dx}px, ${pointer.y - drag.dy}px)`
    track(drag)
    const bottom = viewportHeight() - EDGE
    drag.speed =
      pointer.y < TOP_EDGE
        ? -(TOP_EDGE - pointer.y) / 4
        : pointer.y > bottom
          ? (pointer.y - bottom) / 4
          : 0
    if (drag.speed && !frame) frame = requestAnimationFrame(scroll)
  }

  function scroll(): void {
    frame = 0
    if (!drag?.started || !drag.speed) return
    window.scrollBy(0, drag.speed)
    track(drag)
    frame = requestAnimationFrame(scroll)
  }

  function track(current: Drag): void {
    const { x, y } = pointer
    const pool = part('pool')
    const grid = part('grid')
    let target: Drag['target'] = null
    if (current.from === 'list' && pool && inside(pool.getBoundingClientRect(), x, y))
      target = 'remove'
    else if (grid && inside(grid.getBoundingClientRect(), x, y, 48)) {
      let best: HTMLElement | null = null
      let distance = Infinity
      for (const card of cards()) {
        const rect = card.getBoundingClientRect()
        const across = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
        const down = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
        if (down * 4 + across < distance) {
          distance = down * 4 + across
          best = card
        }
      }
      if (!best) target = 0
      else {
        const rect = best.getBoundingClientRect()
        target = Number(best.dataset.index) + (y > rect.top + rect.height / 2 ? 1 : 0)
      }
    }
    current.target = target
    removing.value = target === 'remove'
    place(target)
  }

  function place(target: Drag['target']): void {
    const wrap = part('wrap')
    if (target === null || target === 'remove' || !wrap) {
      marker.value = null
      return
    }
    const box = wrap.getBoundingClientRect()
    const all = cards()
    const before = all[target]
    const card = before ?? all.at(-1)
    if (!card) {
      marker.value = { left: 4, top: 0, width: box.width - 8 }
      return
    }
    const rect = card.getBoundingClientRect()
    marker.value = {
      left: rect.left - box.left,
      top: (before ? rect.top - 4 : rect.bottom) - box.top,
      width: rect.width,
    }
  }

  // The click that ends a drag lands on whatever is under the pointer.
  function swallowClick(): void {
    const stop = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('click', stop, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }))
  }

  function end(commit: boolean): void {
    const done = drag
    drag = null
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onCancel)
    document.removeEventListener('keydown', onKey)
    cancelAnimationFrame(frame)
    frame = 0
    marker.value = null
    removing.value = false
    lifted.value = null
    document.body.classList.remove('lists-dragging')
    if (!done?.started) return
    swallowClick()
    done.ghost?.remove()
    const target = done.target
    if (!commit || target === null) return
    if (target === 'remove') {
      if (done.from === 'list') editor.remove(done.index)
    } else if (done.from === 'pool') editor.addHero(done.hero, target)
    else editor.move(done.index, target > done.index ? target - 1 : target)
  }

  // A browser may fold the last moves into the lift, so the drop is placed
  // where the pointer comes up.
  function onUp(event: PointerEvent): void {
    if (drag?.started) {
      pointer = { x: event.clientX, y: event.clientY }
      track(drag)
    }
    end(true)
  }
  const onCancel = (): void => end(false)
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') end(false)
  }

  onBeforeUnmount(() => end(false))

  return { marker, removing, lifted, onDown }
}

export type ListDrag = ReturnType<typeof useListDrag>

const DRAG: InjectionKey<ListDrag> = Symbol('list-drag')

export const provideListDrag = (drag: ListDrag): void => provide(DRAG, drag)
export const useListDragState = (): ListDrag => inject(DRAG)!
