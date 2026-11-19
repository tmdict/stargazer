<script setup lang="ts">
/* A round control on an Honor Duel unit's portrait: a button around what the
   default slot holds, or with `readonly` that content alone. An empty one is
   a dashed ring. The host sets the size (--badge-size) and may fill an empty
   one that sits over a picture (--slot-fill). */

defineProps<{
  label: string
  empty?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{ press: [event: MouseEvent] }>()
</script>

<template>
  <component
    :is="readonly ? 'span' : 'button'"
    :type="readonly ? undefined : 'button'"
    :role="readonly ? 'img' : undefined"
    class="duel-slot"
    :class="{ empty, readonly }"
    :title="label"
    :aria-label="label"
    @click="!readonly && emit('press', $event)"
  >
    <slot />
  </component>
</template>

<style scoped>
.duel-slot {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--badge-size);
  height: var(--badge-size);
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.duel-slot.empty {
  border: 1.5px dashed var(--color-border-primary);
  background: var(--slot-fill, none);
}

.duel-slot.readonly {
  cursor: default;
}

@media (hover: hover) {
  .duel-slot:not(.readonly):hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
}

@media (pointer: coarse) {
  .duel-slot:not(.readonly)::after {
    content: '';
    position: absolute;
    inset: -6px;
  }
}
</style>
