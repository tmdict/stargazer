<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/* Defers building its slot until the wrapper nears the viewport, so heavy leaf
   content (e.g. saved-team thumbnails) mounts on approach instead of all at
   once at page mount. One-way: once built, content never unmounts. */

defineProps<{
  // Placeholder height until the content mounts, so scroll geometry holds. An
  // offscreen estimate is enough; the real content replaces it before it
  // scrolls into view.
  estimatedHeight: number
}>()

// Build starts this far below the viewport: normal scrolling meets content
// that already exists, and only a hard flick can outrun it.
const ROOT_MARGIN_PX = 600

const el = ref<HTMLElement>()
const shown = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    shown.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      shown.value = true
      observer?.disconnect()
      observer = null
    },
    { rootMargin: `${ROOT_MARGIN_PX}px 0px` },
  )
  observer.observe(el.value!)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="el" :style="shown ? undefined : { minHeight: `${estimatedHeight}px` }">
    <slot v-if="shown" />
  </div>
</template>
