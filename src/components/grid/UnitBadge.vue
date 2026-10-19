<script setup lang="ts">
/* A unit badge: an icon in a colored disc on a portrait's rim. The board sets
   the disc's size and border (--badge-size, --badge-border) and its host
   places it. */

import type { Component } from 'vue'

import IconBell from '../ui/IconBell.vue'
import IconClassMage from '../ui/IconClassMage.vue'
import IconClassSupport from '../ui/IconClassSupport.vue'
import IconClassTank from '../ui/IconClassTank.vue'
import IconFlame from '../ui/IconFlame.vue'
import type { BadgeIcon } from '@/lib/types/unitBadge'

defineProps<{
  icon: BadgeIcon
  color: string
  glyph: number
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
  <span class="unit-badge" :style="{ backgroundColor: color }">
    <component :is="ICONS[icon]" :size="glyph" />
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
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.12s ease-out,
    box-shadow 0.12s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .unit-badge {
    transition: none;
  }
}
</style>
