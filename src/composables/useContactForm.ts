import { ref } from 'vue'

// Module scope: the form is mounted once at the app root, and its openers sit
// elsewhere in the tree.
const isOpen = ref(false)

export function useContactForm() {
  const open = (): void => {
    isOpen.value = true
  }
  return { isOpen, open }
}
