import { markRaw, shallowRef, watchEffect, type Component, type Ref, unref } from 'vue'

interface ContentComponentOptions {
  type: 'skill' | 'about' | 'default'
  name: string | Ref<string>
  locale: string | Ref<string>
  fallbackToEnglish?: boolean
}

export function useContentComponent(options: ContentComponentOptions) {
  const { type, name, locale, fallbackToEnglish = true } = options

  // Import all content components eagerly (at build time)
  const contentModules = import.meta.glob('@/content/**/*.vue', { eager: true })

  const ContentComponent = shallowRef<Component | null>(null)

  // Synchronously update component when locale or name changes
  watchEffect(() => {
    // Get the current values whether it's a ref or not
    const currentLocale = unref(locale)
    const currentName = unref(name)

    if (!currentName) {
      ContentComponent.value = null
      return
    }

    // Build the path based on content type (using locale in filename)
    const buildPath = (lang: string) => {
      switch (type) {
        case 'skill':
          return `/src/content/${currentName}Skill.${lang}.vue`
        case 'about':
          return `/src/content/AboutPage.${lang}.vue`
        default:
          return `/src/content/${currentName}.${lang}.vue`
      }
    }

    // Try to get the component synchronously
    let module = contentModules[buildPath(currentLocale)] as { default: Component } | undefined

    // Fallback to English if not found
    if (!module && fallbackToEnglish && currentLocale !== 'en') {
      console.warn(`Content not found for ${currentName}.${currentLocale}, falling back to en`)
      module = contentModules[buildPath('en')] as { default: Component } | undefined
    }

    // Set the component or null if not found
    ContentComponent.value = module?.default ? markRaw(module.default) : null
  })

  return { ContentComponent }
}
