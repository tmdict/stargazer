<script setup lang="ts">
import HelpBoard from '@/components/help/HelpBoard.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import TeamModePicker from '@/components/teams/TeamModePicker.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import IconFilePlus from '@/components/ui/IconFilePlus.vue'
import IconFolderOpen from '@/components/ui/IconFolderOpen.vue'
import IconImagePlus from '@/components/ui/IconImagePlus.vue'
import IconSave from '@/components/ui/IconSave.vue'
import IconSavePlus from '@/components/ui/IconSavePlus.vue'
import IconSwap from '@/components/ui/IconSwap.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { appLabel } from '@/utils/skillLabels'

const lang = useRouteLocale()
const label = (key: string): string => appLabel(key, lang.value)

const TEAM_NAME = 'S8 SL'

const BOARDS = [
  [
    { slug: 'frieren', at: [2, 1] as const },
    { slug: 'thoran', at: [0, 3] as const },
  ],
  [{ slug: 'valen', at: [2, 2] as const }],
  [{ slug: 'rhys', at: [2, 3] as const }],
]
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('teams')">
        <div class="help-mock-title">{{ TEAM_NAME }}</div>
        <div class="help-mock-bar centered">
          <TeamModePicker active-mode="5v5" />
          <span class="help-seg">
            <span>{{ label('default') }}</span
            ><span class="on">{{ label('mode-sl') }}</span>
          </span>
        </div>
        <div class="help-mock-bar centered">
          <span class="control-btn danger">
            <IconFilePlus :size="13" class="btn-icon" /><span class="btn-text">{{
              label('new')
            }}</span>
          </span>
          <span class="control-btn">
            <IconSave :size="13" class="btn-icon" /><span class="btn-text">{{
              label('save')
            }}</span>
          </span>
          <span class="control-btn secondary">
            <IconSavePlus :size="13" class="btn-icon" /><span class="btn-text">{{
              label('save-as-new')
            }}</span>
          </span>
          <span class="control-btn secondary">
            <IconFolderOpen :size="13" class="btn-icon" /><span class="btn-text">{{
              label('load')
            }}</span>
          </span>
          <span class="control-btn secondary"><IconImagePlus :size="14" class="btn-icon" /></span>
        </div>
        <div class="help-boards">
          <span
            v-for="(tokens, i) in BOARDS"
            :key="i"
            class="help-board-card"
            :class="{ active: i === 0 }"
          >
            <HelpBoard :tokens />
            <span class="help-round"><IconSwap :size="11" /></span>
          </span>
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="label('saved')">
        <div class="help-mock-bar">
          <span class="help-seg">
            <span class="on">{{ label('all') }}</span
            ><span>1v1</span><span>3v3</span><span>5v5</span>
          </span>
          <span class="help-seg"
            ><span>{{ label('one-sided') }}</span></span
          >
        </div>
        <div class="help-card">
          <span class="help-card-thumb">
            <HelpBoard v-for="(tokens, i) in BOARDS" :key="i" :tokens />
          </span>
          <span class="help-card-name">{{ TEAM_NAME }} <IconEdit :size="11" /></span>
          <span class="help-card-tags"><span>5V5</span><span>SL</span></span>
          <span class="help-card-actions">
            <span class="primary">{{ label('load') }}</span>
            <span>{{ label('duplicate') }}</span>
            <span class="icon"><IconCopy :size="11" /></span>
            <span class="icon"><IconDownload :size="11" /></span>
            <span class="danger">{{ label('delete') }}</span>
          </span>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.help-mock-title {
  margin: 0 0 8px;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
}

/* Copy of TeamVariantPicker. */
.help-seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border-primary);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.help-seg span {
  white-space: nowrap;
  padding: 5px 14px;
  border-radius: 999px;
}

.help-seg span.on {
  background: var(--color-primary);
  color: #fff;
}

.help-boards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.help-board-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 2px solid transparent;
  border-radius: var(--radius-large);
}

.help-board-card.active {
  border-color: var(--color-primary);
}

.help-board-card .help-board,
.help-card-thumb .help-board {
  width: 100%;
}

.help-round {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
}

/* Copy of a SavedTeamsList card. */
.help-card {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-primary);
  border-radius: var(--radius-large);
}

.help-card-thumb {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 8px;
  background: #e6e1d6;
  border-radius: var(--radius-medium);
}

.help-card-name {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 6px;
  font-weight: 700;
}

.help-card-name svg {
  color: var(--color-text-secondary);
}

.help-card-tags {
  display: flex;
  gap: 5px;
}

.help-card-tags span {
  padding: 0 8px;
  border: 1.5px solid var(--color-primary);
  border-radius: 999px;
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 700;
}

.help-card-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.help-card-actions span {
  display: inline-grid;
  place-items: center;
  padding: 4px 10px;
  background: var(--color-bg-white);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  color: #555;
  font-size: 0.8rem;
  font-weight: 700;
}

.help-card-actions .primary {
  flex: 1;
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.help-card-actions .danger {
  flex: 1;
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.help-card-actions .icon {
  padding: 4px 7px;
}
</style>
