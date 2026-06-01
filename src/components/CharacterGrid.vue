<!-- Responsive wrap-grid of character icons, shared by the arena roster
     (CharacterSelection) and the skills roster (SkillsSelection) so the two
     stay in lockstep. The inset/padding is the caller's job — it differs by
     surrounding chrome, so pass a class to add it. -->
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
}

@media (max-width: 768px) {
  .character-grid {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .character-grid {
    gap: var(--spacing-sm);
  }
}
</style>
