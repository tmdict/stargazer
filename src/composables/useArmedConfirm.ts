import { onScopeDispose, ref } from 'vue'

/* Two-step inline confirm for destructive buttons (the app's no-modal style):
 * a first click arms the target, a second within the window fires. One armed
 * target at a time per instance; `key` distinguishes sibling buttons sharing
 * an instance (e.g. one per card). `confirm` returns true when the action
 * should run. `disarm` is for callers whose target can change underneath an
 * armed click (the boards it would act on were replaced), so the second click
 * can never land on different content than the first was armed for. `pause`
 * and `resume` are for callers that show choices while armed: the window must
 * not lapse while the user is still on them, and restarts in full after. */
export function useArmedConfirm(disarmAfterMs = 3000) {
  const armed = ref<string | null>(null)
  let disarmTimer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(disarmTimer))

  const disarm = (): void => {
    clearTimeout(disarmTimer)
    armed.value = null
  }

  const startWindow = (): void => {
    clearTimeout(disarmTimer)
    disarmTimer = setTimeout(disarm, disarmAfterMs)
  }

  const confirm = (key: string): boolean => {
    if (armed.value === key) {
      disarm()
      return true
    }
    armed.value = key
    startWindow()
    return false
  }

  const pause = (): void => clearTimeout(disarmTimer)

  const resume = (): void => {
    if (armed.value !== null) startWindow()
  }

  return { armed, confirm, disarm, pause, resume }
}
