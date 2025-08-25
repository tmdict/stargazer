<script setup lang="ts">
import { computed, ref } from 'vue'

import SkillModal from './modals/SkillModal.vue'
import IconInfo from './ui/IconInfo.vue'
import { DOCUMENTED_SKILLS, getCharacterSkill } from '../lib/skill'
import type { CharacterType } from '../lib/types/character'

interface Props {
  character: CharacterType
  icons: { [key: string]: string }
}

const props = defineProps<Props>()

const hasDocumentedSkill = computed(() => {
  const skill = getCharacterSkill(props.character.id)
  return !!(skill && DOCUMENTED_SKILLS.includes(skill.id as any))
})

// Skill modal state
const showSkillModal = ref(false)
const selectedSkillName = ref('')

const openSkillModal = () => {
  // Capitalize first letter for proper filename
  selectedSkillName.value =
    props.character.name.charAt(0).toUpperCase() + props.character.name.slice(1)
  showSkillModal.value = true
}
</script>

<template>
  <div class="character-info">
    <img :src="icons[`faction-${character.faction}`]" :alt="character.faction" class="icon" />
    <button v-if="hasDocumentedSkill" @click="openSkillModal" class="skill-button hide-on-mobile">
      <IconInfo class="icon skill-info-icon" />
    </button>
    <div v-else class="icon-spacer hide-on-mobile" />
    <img :src="icons[`class-${character.class}`]" :alt="character.class" class="icon" />
  </div>

  <!-- Skill Modal -->
  <SkillModal
    :show="showSkillModal"
    :skillName="selectedSkillName"
    @close="showSkillModal = false"
  />
</template>

<style scoped>
.character-info {
  display: flex;
  justify-content: center;
  gap: 0.2rem;
  padding-top: 0.4rem;
}

.character-info .icon {
  width: 21px;
  height: 21px;
  border: 1px solid #484848;
  border-radius: 50%;
}

.icon-spacer {
  width: 10px;
}

.skill-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.skill-button:hover {
  transform: scale(1.1);
}

.skill-info-icon {
  color: var(--color-primary);
  background-color: white;
}

/* Media Queries */
@media (max-width: 768px) {
  .character-info {
    gap: 0.5rem;
  }

  /* Hide skill button and spacer on mobile */
  .hide-on-mobile {
    display: none;
  }
}

@media (max-width: 480px) {
  .character-info {
    gap: 0.25rem;
  }

  .character-info .icon {
    width: 18px;
    height: 18px;
  }
}
</style>
