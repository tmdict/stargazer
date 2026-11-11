// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import BaseModal from '@/components/modals/BaseModal.vue'
import DropdownSelect from '@/components/ui/DropdownSelect.vue'

describe('BaseModal outside clicks', () => {
  let teardown: (() => void) | undefined

  afterEach(() => {
    teardown?.()
    teardown = undefined
  })

  // An overlay starts hearing clicks a moment after it opens.
  const pastClickDelay = () => new Promise((resolve) => setTimeout(resolve, 60))
  const click = (el: Element): void => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  it('stays open for a pick in a floating dropdown list inside it', async () => {
    let closed = 0
    const picked: string[] = []
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({
      render: () =>
        h(
          BaseModal,
          { show: true, label: 'Import', onClose: () => closed++ },
          {
            default: () =>
              h(DropdownSelect, {
                label: 'Unit',
                variant: 'dark',
                floating: true,
                clickOnly: true,
                items: [{ key: 'hero', label: 'Hero', selected: false }],
                onSelect: (key: string) => picked.push(key),
              }),
          },
        ),
    })
    app.use(createPinia())
    app.mount(host)
    teardown = () => {
      app.unmount()
      host.remove()
    }

    await pastClickDelay()
    click(document.querySelector('.dropdown button')!)
    await nextTick()
    await pastClickDelay()
    const row = document.querySelector('.list.floating button')!
    expect(row.closest('[role="dialog"]')).toBeNull()
    click(row)
    await nextTick()
    expect(picked).toEqual(['hero'])
    expect(closed).toBe(0)
  })
})
