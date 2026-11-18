import { ref, type Ref } from 'vue'

/* Which list the Honor Duel hero pickers show: the Trial Cards' units while
 * on, else the shop's heroes. One value for the tab's picker and the popup on
 * an empty tile, so they never disagree. No board holds it, so it outlives a
 * rebuild of the boards and lasts while the page is open; nothing stores it. */
const trial = ref(false)

export const useDuelList = (): Ref<boolean> => trial
