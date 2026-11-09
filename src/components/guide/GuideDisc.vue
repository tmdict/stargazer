<script setup lang="ts">
/* The guide's round picture frame, a ring round a picture on a backdrop: a
   hero's portrait on its tier backdrop (GuidePortrait), or a phantimal's or an
   artifact's picture, or an icon, on the plain one. */

// Without `size` the disc takes `--size` from its host's stylesheet (or the
// 28px default), so a host can resize its discs in a container query; a host
// can colour the ring with `--disc-ring`.
const { size, backdrop } = defineProps<{ size?: number; backdrop?: string }>()
</script>

<template>
  <span
    class="disc"
    :style="{
      '--size': size ? `${size}px` : undefined,
      backgroundImage: backdrop ? `url(${backdrop})` : undefined,
    }"
  >
    <slot />
  </span>
</template>

<style scoped>
.disc {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size, 28px);
  height: var(--size, 28px);
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 2px var(--disc-ring, #fff);
  background-size: cover;
  background-position: center;
}
.disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #fff4;
}
.disc :slotted(*) {
  position: relative;
  z-index: 1;
}
.disc :slotted(img) {
  width: calc(var(--size, 28px) + 5px);
  height: calc(var(--size, 28px) + 5px);
  object-fit: cover;
}
</style>
