<script setup lang="ts">
/* The floating white card behind an upgrade edit bar (the board docks and the
   Rosters tab), holding a single flex row. The owner arranges its content
   (placement, wrapping, gaps) with its own class on this root, from
   UpgradeDockChip, UpgradeDockLabel, UpgradeDockDivider, UpgradeLayerChips and
   UpgradeBulkActions. */
</script>

<template>
  <div class="upgrade-dock">
    <slot />
  </div>
</template>

<style scoped>
/* Visually detached ("pop") from the flat panel strip above it. */
.upgrade-dock {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-large);
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.09);
}
</style>
