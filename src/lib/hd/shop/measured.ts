// The measured odds table kept in this repo: what the odds view shows, what an
// example shop is drawn from, and what the calculator uses when the data pack
// has no table of its own.

import odds from '@/data/hd/shop/odds.json'
import { SHOP_FACTS } from './goods'
import { checkOdds } from './odds'
import type { OddsTable } from './types'

export const MEASURED_ODDS: OddsTable = checkOdds(odds as OddsTable, SHOP_FACTS)
