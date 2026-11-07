// @vitest-environment jsdom
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import { useFocusTrap } from '@/composables/useFocusTrap'

// A dialog surface like BaseModal's, with a picture whose controls are inert.
const mount = (open: boolean) => {
  const host = document.createElement('div')
  document.body.append(host)
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const isOpen = ref(open)
  createApp(
    defineComponent({
      setup() {
        const surface = ref<HTMLElement>()
        const { trapTab } = useFocusTrap(surface, isOpen)
        return () =>
          isOpen.value
            ? h('div', { ref: surface, tabindex: -1, onKeydown: trapTab }, [
                h('button', { id: 'first' }),
                h('a', { id: 'last', href: '#' }),
                h('div', { inert: '' }, [h('input', { type: 'checkbox', tabindex: -1 })]),
              ])
            : null
      },
    }),
  ).mount(host)
  return { isOpen, opener }
}

const tab = (shiftKey = false): void => {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
  )
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('useFocusTrap', () => {
  it('takes focus for a dialog that mounts open, and gives it back on close', async () => {
    const { isOpen, opener } = mount(true)
    await nextTick()
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')

    isOpen.value = false
    await nextTick()
    expect(document.activeElement).toBe(opener)
  })

  it('cycles between the ends a reader can focus, past an inert picture', async () => {
    mount(true)
    await nextTick()
    document.querySelector<HTMLElement>('[tabindex="-1"]')?.focus()

    tab(true)
    expect(document.activeElement?.id).toBe('last')

    tab()
    expect(document.activeElement?.id).toBe('first')
  })
})
