import { onScopeDispose, ref } from 'vue'

/* Two-step confirm for destructive buttons: the first trigger arms for a beat
 * (auto-disarming so a stray click can't linger), the second fires the action. */
export function useArmedAction(action: () => void, disarmMs = 3000) {
  const armed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(timer))

  const trigger = (): void => {
    clearTimeout(timer)
    if (!armed.value) {
      armed.value = true
      timer = setTimeout(() => {
        armed.value = false
      }, disarmMs)
      return
    }
    armed.value = false
    action()
  }

  return { armed, trigger }
}
