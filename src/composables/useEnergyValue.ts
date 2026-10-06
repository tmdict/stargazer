import { ref } from 'vue'

import { ENERGY_DEFAULT } from '@/lib/mechanics'

/* The initial energy filter's value. One value for every hero list and the
 * Mechanics guide, so they never disagree. It lives in memory only: every load
 * starts from the default, which is what the pre-rendered pages carry. */
const value = ref<number>(ENERGY_DEFAULT)

export const useEnergyValue = () => value
