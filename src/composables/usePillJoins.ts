import { onMounted, onUnmounted, onUpdated, shallowRef, type Ref, type ShallowRef } from 'vue'

/** The sides on which a part of a joined pill touches the next part. */
export interface PillJoin {
  readonly left: boolean
  readonly right: boolean
}

/** Parts touch where they share a line; `tops` are their offsets in the row. */
function lineJoins(tops: readonly number[]): PillJoin[] {
  return tops.map((top, i) => ({ left: tops[i - 1] === top, right: tops[i + 1] === top }))
}

const sameJoins = (a: readonly PillJoin[], b: readonly PillJoin[]): boolean =>
  a.length === b.length &&
  a.every((join, i) => join.left === b[i]?.left && join.right === b[i]?.right)

/* A pill made of several chips breaks wherever its wrapping row does. For the
 * row's parts, in order, this says which neighbours share a part's line, so
 * each line's stretch of the pill can be drawn with its own round ends. A
 * stylesheet cannot tell where a line breaks, hence the measuring: after every
 * render of the owner, and whenever the row or a part changes size.
 *
 * The owner may only restyle a part from the result. A change to a part's size
 * or position would move the breaks it was measured from. */
export function usePillJoins(
  row: Readonly<Ref<HTMLElement | undefined>>,
  part: string,
): Readonly<ShallowRef<readonly PillJoin[]>> {
  const joins = shallowRef<readonly PillJoin[]>([])

  const parts = (): HTMLElement[] => [...(row.value?.querySelectorAll<HTMLElement>(part) ?? [])]

  const measure = (): void => {
    const next = lineJoins(parts().map((el) => el.offsetTop))
    if (!sameJoins(next, joins.value)) joins.value = next
  }

  // The row's width decides where its lines break; a part's own width changes
  // when its font arrives.
  let observer: ResizeObserver | undefined
  const sync = (): void => {
    observer?.disconnect()
    if (row.value) observer?.observe(row.value)
    for (const el of parts()) observer?.observe(el)
    measure()
  }

  onMounted(() => {
    if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(measure)
    sync()
  })
  onUpdated(sync)
  onUnmounted(() => observer?.disconnect())

  return joins
}
