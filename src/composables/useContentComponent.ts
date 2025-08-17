import { markRaw, shallowRef, watchEffect, type Component, type Ref, unref } from 'vue'
import { useI18nStore } from '@/stores/i18n'

interface ContentComponentOptions {
  type: 'skill' | 'about' | 'default'
  name: string | Ref<string>
  fallbackToEnglish?: boolean
}

export function useContentComponent(options: ContentComponentOptions) {
  const { type, name, fallbackToEnglish = true } = options
  const i18n = useI18nStore()

  // Import all content components eagerly (at build time)
  const contentModules = import.meta.glob('@/content/**/*.vue', { eager: true })

  const ContentComponent = shallowRef<Component | null>(null)

  // Synchronously update component when locale or name changes
  watchEffect(() => {
    const locale = i18n.currentLocale
    const currentName = unref(name) // Get the current value whether it's a ref or not

    if (!currentName) {
      ContentComponent.value = null
      return
    }

    // Build the path based on content type (using locale in filename)
    const buildPath = (lang: string) => {
      switch (type) {
        case 'skill':
          return `/src/content/skills/${currentName}.${lang}.vue`
        case 'about':
          return `/src/content/About.${lang}.vue`
        default:
          return `/src/content/${currentName}.${lang}.vue`
      }
    }

    // Try to get the component synchronously
    let module = contentModules[buildPath(locale)] as any

    // Fallback to English if not found
    if (!module && fallbackToEnglish && locale !== 'en') {
      console.warn(`Content not found for ${currentName}.${locale}, falling back to English`)
      module = contentModules[buildPath('en')] as any
    }

    // Set the component or null if not found
    ContentComponent.value = module?.default ? markRaw(module.default) : null
  })

  return { ContentComponent }
}
