/* Help page's Mouse / Touch choice. HelpView sets it as `.touch` on the page
   root, where its styles swap the .help-mouse and .help-touch spans. */

import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

const HelpTouchKey: InjectionKey<Ref<boolean>> = Symbol('HelpTouch')

export function provideHelpTouch(): Ref<boolean> {
  const touch = ref(false)
  provide(HelpTouchKey, touch)
  return touch
}

export function useHelpTouch(): Ref<boolean> {
  return inject(HelpTouchKey, ref(false))
}
