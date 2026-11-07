// @vitest-environment jsdom
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useRuneText } from '@/composables/useRuneText'

// What a reader sees: kept text as it is, and each shape as '#'.
const seen = (el: Element): string => {
  let out = ''
  const walk = (node: Node): void => {
    if (node instanceof Text) out += node.data
    else if (node instanceof Element && node.localName === 'svg') out += '#'
    else node.childNodes.forEach(walk)
  }
  walk(el)
  return out
}

// Vue patches first, then the observer's records arrive as a microtask.
const settle = async (): Promise<void> => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
}

const mount = (render: () => ReturnType<typeof h>) => {
  const host = document.createElement('div')
  document.body.append(host)
  createApp(
    defineComponent({
      setup() {
        const root = ref<HTMLElement>()
        useRuneText(root)
        return () => h('div', { ref: root }, [render()])
      },
    }),
  ).mount(host)
  return host
}

describe('useRuneText', () => {
  it('draws letters as shapes, keeping numbers, words with a digit and punctuation', () => {
    const host = mount(() => h('p', "Map 1 it's 1v1 地图"))
    expect(seen(host)).toBe("### 1 ##'# 1v1 ##")
  })

  it('redraws a text Vue changes and drops the shapes of one it empties', async () => {
    const label = ref('Map')
    const host = mount(() => h('span', label.value))
    expect(seen(host)).toBe('###')

    label.value = 'Maps 2'
    await settle()
    expect(seen(host)).toBe('#### 2')

    label.value = ''
    await settle()
    expect(seen(host)).toBe('')

    label.value = 'Go'
    await settle()
    expect(seen(host)).toBe('##')
  })

  it('follows elements Vue adds, removes and reorders', async () => {
    const shown = ref(true)
    const items = ref(['ab', 'cde'])
    const host = mount(() =>
      h('div', [
        shown.value ? h('b', 'Hi') : null,
        ...items.value.map((item) => h('i', { key: item }, item)),
      ]),
    )
    expect(seen(host)).toBe('#######')

    shown.value = false
    items.value = ['cde', 'ab', 'f']
    await settle()
    expect(seen(host)).toBe('######')
    expect([...host.querySelectorAll('i')].map((el) => el.querySelectorAll('svg').length)).toEqual([
      3, 2, 1,
    ])

    shown.value = true
    await settle()
    expect(seen(host)).toBe('########')
  })
})
