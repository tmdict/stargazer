import { reactive } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  duration: number
}

interface ToastState {
  toasts: ToastItem[]
  nextId: number
}

const state = reactive<ToastState>({
  toasts: [],
  nextId: 1,
})

export function useToast() {
  const show = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    duration: number = 3000,
  ) => {
    const toast: ToastItem = {
      id: state.nextId++,
      message,
      type,
      duration,
    }

    state.toasts.push(toast)

    // Auto-remove after duration
    setTimeout(() => {
      remove(toast.id)
    }, duration)

    return toast.id
  }

  const remove = (id: number) => {
    const index = state.toasts.findIndex((toast) => toast.id === id)
    if (index > -1) {
      state.toasts.splice(index, 1)
    }
  }

  const clear = () => {
    state.toasts.splice(0)
  }

  // Convenience methods
  const success = (message: string, duration?: number) => show(message, 'success', duration)

  const error = (message: string, duration?: number) => show(message, 'error', duration)

  const info = (message: string, duration?: number) => show(message, 'info', duration)

  return {
    toasts: state.toasts,
    show,
    remove,
    clear,
    success,
    error,
    info,
  }
}
