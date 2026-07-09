import { onScopeDispose, ref } from 'vue'

/* Two-step inline confirm for destructive buttons (the app's no-modal style):
 * a first click arms the target, a second within the window fires. One armed
 * target at a time per instance; `key` distinguishes sibling buttons sharing
 * an instance (e.g. one per card). `confirm` returns true when the action
 * should run. */
export function useArmedConfirm(disarmAfterMs = 3000) {
  const armed = ref<string | null>(null)
  let disarmTimer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(disarmTimer))

  const confirm = (key: string): boolean => {
    clearTimeout(disarmTimer)
    if (armed.value === key) {
      armed.value = null
      return true
    }
    armed.value = key
    disarmTimer = setTimeout(() => {
      armed.value = null
    }, disarmAfterMs)
    return false
  }

  return { armed, confirm }
}
