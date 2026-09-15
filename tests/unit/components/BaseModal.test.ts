// @vitest-environment jsdom
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import BaseModal from '@/components/modals/BaseModal.vue'

// Presses Tab while `el` has focus and reports whether the trap claimed it.
const pressTab = (el: HTMLElement, shiftKey = false): boolean => {
  el.focus()
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
  el.dispatchEvent(event)
  return event.defaultPrevented
}

describe('BaseModal keyboard focus', () => {
  let teardown: (() => void) | undefined

  afterEach(() => {
    teardown?.()
    teardown = undefined
  })

  it('names the dialog, moves focus into it, cycles Tab inside it, and returns focus on close', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const show = ref(false)
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({
      render: () =>
        h(
          BaseModal,
          { show: show.value, label: 'Team preview', onClose: () => (show.value = false) },
          {
            default: () => [
              h('button', { id: 'first-control' }),
              h('button', { id: 'last-control' }),
            ],
          },
        ),
    })
    app.use(createPinia())
    app.mount(host)
    teardown = () => {
      app.unmount()
      host.remove()
      opener.remove()
    }

    show.value = true
    await nextTick()
    await nextTick()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Team preview')
    expect(document.activeElement).toBe(dialog)

    // The close button precedes the slot content, so it is the first control.
    const closeButton = dialog.querySelector<HTMLElement>('button')!
    const last = document.getElementById('last-control')!
    expect(pressTab(dialog, true)).toBe(true)
    expect(document.activeElement).toBe(last)
    expect(pressTab(last)).toBe(true)
    expect(document.activeElement).toBe(closeButton)
    expect(pressTab(closeButton, true)).toBe(true)
    expect(document.activeElement).toBe(last)
    // Between the ends the browser's own order applies.
    expect(pressTab(document.getElementById('first-control')!)).toBe(false)

    show.value = false
    await nextTick()
    expect(document.activeElement).toBe(opener)
  })
})
