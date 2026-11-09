import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'

import App from './App.vue'
import { startMove } from '@/composables/useMove'
import { vScrollChain } from '@/directives/scrollChain'
import router from '@/router'

import './styles/base.css'
import './styles/controls.css'
import './styles/variables.css'

const app = createApp(App)
const head = createHead()

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(head)
app.directive('scroll-chain', vScrollChain)

await startMove(pinia)
// The script tag is async, so this can run before the page's body is parsed.
if (document.readyState === 'loading') {
  await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve))
}
app.mount('#app')
