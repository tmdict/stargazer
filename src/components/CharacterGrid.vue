<!-- Responsive wrap-grid of character icons shared by the arena
     picker (CharacterSelection) and the skills/guide hero list (SkillsSelection).
     Owns the grid's inset. The top one adds to the host panel's row gap, so
     the heroes sit further below the filters than the control rows sit from
     each other. -->
<template>
  <div class="character-grid">
    <slot />
  </div>
</template>

<style scoped>
.character-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  justify-content: flex-start;
  align-content: flex-start;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
}

@media (max-width: 768px) {
  .character-grid {
    justify-content: center;
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .character-grid {
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
  }
}
</style>
