import { markRaw, shallowRef, unref, watchEffect, type Component, type Ref } from 'vue'

import { formatToCamelCase } from '@/utils/nameFormatting'

interface ContentComponentOptions {
  name: string | Ref<string>
  locale: string | Ref<string>
  fallbackToEnglish?: boolean
}

/** Resolves a localized page-content component from `@/content/page/<Name>.<lang>.vue`. */
export function useContentComponent(options: ContentComponentOptions) {
  const { name, locale, fallbackToEnglish = true } = options

  // Import page content eagerly (at build time)
  const contentModules = import.meta.glob('@/content/page/*.vue', { eager: true })

  const ContentComponent = shallowRef<Component | null>(null)

  const buildPath = (currentName: string, lang: string) =>
    `/src/content/page/${formatToCamelCase(currentName)}.${lang}.vue`

  // Synchronously update component when locale or name changes
  watchEffect(() => {
    const currentLocale = unref(locale)
    const currentName = unref(name)

    if (!currentName) {
      ContentComponent.value = null
      return
    }

    let module = contentModules[buildPath(currentName, currentLocale)] as
      | { default: Component }
      | undefined

    // Fallback to English if not found
    if (!module && fallbackToEnglish && currentLocale !== 'en') {
      console.warn(`Content not found for ${currentName}.${currentLocale}, falling back to en`)
      module = contentModules[buildPath(currentName, 'en')] as { default: Component } | undefined
    }

    ContentComponent.value = module?.default ? markRaw(module.default) : null
  })

  return { ContentComponent }
}
