import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'

import App from './App.vue'
import { vScrollChain } from '@/directives/scrollChain'
import router from '@/router'

import './styles/base.css'
import './styles/controls.css'
import './styles/variables.css'

const app = createApp(App)
const head = createHead()

app.use(createPinia())
app.use(router)
app.use(head)
app.directive('scroll-chain', vScrollChain)

app.mount('#app')
