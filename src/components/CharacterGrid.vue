<!-- Responsive wrap-grid of character icons shared by the arena
     (CharacterSelection) and skills/guide (SkillsSelection) rosters. Owns the
     default roster inset; callers can override the padding. -->
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
  padding: var(--spacing-lg);
}

@media (max-width: 768px) {
  .character-grid {
    justify-content: center;
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .character-grid {
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
  }
}
</style>
