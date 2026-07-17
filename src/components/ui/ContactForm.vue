<script setup lang="ts">
/* Frosted contact panel: submits the "contact" form via fetch, so no page
   navigation happens. public/forms.html carries the hidden twin that
   registers the form at deploy; the field names must match. */

import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { useToast } from '@/composables/useToast'
import { useI18nStore } from '@/stores/i18n'

const { trigger = null } = defineProps<{
  // The header button that toggles the panel. Its presses are excluded from
  // the outside-press dismissal so the button's own click handler keeps
  // toggle semantics (close would otherwise fire first and the click reopen).
  trigger?: Element | null
}>()

const open = defineModel<boolean>('open', { required: true })

const i18n = useI18nStore()
const { success, error } = useToast()

const panelEl = ref<HTMLElement | null>(null)
const nameEl = ref<HTMLInputElement | null>(null)
const name = ref('')
const message = ref('')
const sending = ref(false)

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  nameEl.value?.focus()
})

// On success the panel closes and a toast confirms; a failure keeps the
// draft in place for a retry.
const submit = async (): Promise<void> => {
  if (sending.value || !message.value.trim()) return
  sending.value = true
  try {
    // Form posts are accepted on any path; form-name routes them, and the
    // empty honeypot field marks the submission as human.
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'form-name': 'contact',
        name: name.value.trim(),
        message: message.value.trim(),
        'bot-field': '',
      }).toString(),
    })
    if (!res.ok) throw new Error(`contact form POST failed: ${res.status}`)
    name.value = ''
    message.value = ''
    open.value = false
    success(i18n.t('app.contact-success'))
  } catch {
    error(i18n.t('app.contact-error'))
  } finally {
    sending.value = false
  }
}

const onDocPointerDown = (e: PointerEvent): void => {
  if (!open.value || !(e.target instanceof Node)) return
  if (panelEl.value?.contains(e.target) || trigger?.contains(e.target)) return
  open.value = false
}

const onKeyDown = (e: KeyboardEvent): void => {
  if (e.key !== 'Escape' || !open.value) return
  e.stopPropagation()
  open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeyDown, { capture: true })
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeyDown, { capture: true })
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelEl"
      class="contact-panel"
      role="dialog"
      :aria-label="i18n.t('app.contact')"
    >
      <h3 class="panel-title">{{ i18n.t('app.contact') }}</h3>
      <form @submit.prevent="submit">
        <div class="field-row">
          <label class="field-label" for="contact-name">{{ i18n.t('app.contact-name') }}</label>
          <input id="contact-name" ref="nameEl" v-model="name" class="field-input" type="text" />
        </div>
        <div class="field-row">
          <label class="field-label" for="contact-message">
            {{ i18n.t('app.contact-message') }}
          </label>
          <textarea id="contact-message" v-model="message" class="field-input field-area" />
        </div>
        <div class="panel-foot">
          <button type="submit" class="send-btn" :disabled="sending || !message.trim()">
            {{ i18n.t('app.send') }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
/* Tooltip-family chrome (TooltipPopup's frosted look), sized as a small
   centered panel; the modal layer index keeps it under open tooltips. */
.contact-panel {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, calc(100vw - 32px));
  z-index: 9998;
  background: rgba(20, 20, 20, 0.78);
  /* No manual -webkit- prefix: the build auto-prefixes, and a hand-written
     duplicate makes the minifier drop the standard property. */
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-large);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  padding: 22px 24px;
  color: #fff;
}

.panel-title {
  margin: 0 0 16px;
  font-size: 1rem;
  font-weight: 700;
}

.field-row {
  margin-bottom: 12px;
}

.field-label {
  display: block;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  font: inherit;
  font-size: 0.85rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-small);
  padding: 8px 10px;
}

.field-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(95, 196, 187, 0.3);
}

.field-area {
  resize: vertical;
  min-height: 140px;
}

.panel-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.send-btn {
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  color: #fff;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-medium);
  padding: 6px 14px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.send-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

/* Solid when disabled; the darker teal reads inactive next to the enabled
   primary, and hover styling never applies to a disabled button. */
.send-btn:disabled {
  background: var(--color-primary-hover);
  cursor: default;
}

@media (max-width: 480px) {
  .contact-panel {
    padding: 18px;
  }

  .field-area {
    min-height: 110px;
  }
}
</style>
