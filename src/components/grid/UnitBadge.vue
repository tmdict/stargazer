<script setup lang="ts">
/* A unit badge: an icon in a colored disc on a portrait's rim, or what the
   default slot holds in its place (a letter, a picture). The board sets the
   disc's size and border (--badge-size, --badge-border) and its host places
   it. `plain` leaves the disc out and keeps the content's size and place, for
   a host that draws a ring of its own. */

import type { Component } from 'vue'

import IconBell from '../ui/IconBell.vue'
import IconClassMage from '../ui/IconClassMage.vue'
import IconClassSupport from '../ui/IconClassSupport.vue'
import IconClassTank from '../ui/IconClassTank.vue'
import IconFlame from '../ui/IconFlame.vue'
import type { BadgeIcon } from '@/lib/types/unitBadge'

defineProps<{
  icon?: BadgeIcon
  // Any CSS background: a colour or a gradient.
  color?: string
  glyph?: number
  plain?: boolean
}>()

const ICONS: Record<BadgeIcon, Component> = {
  bell: IconBell,
  flame: IconFlame,
  tank: IconClassTank,
  mage: IconClassMage,
  support: IconClassSupport,
}
</script>

<template>
  <span class="unit-badge" :class="{ plain }" :style="{ background: color }">
    <slot><component :is="ICONS[icon]" v-if="icon" :size="glyph" /></slot>
  </span>
</template>

<style scoped>
.unit-badge {
  width: var(--badge-size);
  height: var(--badge-size);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--badge-border) solid #fff;
  border-radius: 50%;
  overflow: hidden;
  color: #fff;
  font-size: calc(var(--badge-size) * 0.55);
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.12s ease-out,
    box-shadow 0.12s ease-out;
}

.unit-badge.plain {
  border: none;
  box-shadow: none;
  color: inherit;
}

.unit-badge :slotted(img) {
  width: 92%;
  height: 92%;
  object-fit: contain;
}

@media (prefers-reduced-motion: reduce) {
  .unit-badge {
    transition: none;
  }
}
</style>
