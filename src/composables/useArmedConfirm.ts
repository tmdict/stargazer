import { onScopeDispose, ref } from 'vue'

/* Two-step inline confirm for destructive buttons (the app's no-modal style):
 * a first click arms the target, a second within the window fires. One armed
 * target at a time per instance; `key` distinguishes sibling buttons sharing
 * an instance (e.g. one per card). `confirm` returns true when the action
 * should run. `disarm` is for callers whose target can change underneath an
 * armed click (the boards it would act on were replaced), so the second click
 * can never land on different content than the first was armed for. */
export function useArmedConfirm(disarmAfterMs = 3000) {
  const armed = ref<string | null>(null)
  let disarmTimer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(disarmTimer))

  const disarm = (): void => {
    clearTimeout(disarmTimer)
    armed.value = null
  }

  const confirm = (key: string): boolean => {
    clearTimeout(disarmTimer)
    if (armed.value === key) {
      armed.value = null
      return true
    }
    armed.value = key
    disarmTimer = setTimeout(disarm, disarmAfterMs)
    return false
  }

  return { armed, confirm, disarm }
}
