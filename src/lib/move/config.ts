/* Settings of the move from the old address, read by the app and by the build
 * (scripts/movePages.ts), so this file imports nothing. Everything under
 * lib/move goes when recovery retires. */

export const OLD_HOST = 'stargazer.tmdict.com'

/* 1: an old page hands the visitor's data over as it opens. 2: the old address
 * answers with redirects. In both, the banner's popup offers the hand-over in
 * one click. public/_redirects carries the old address's redirect rule in
 * stage 2 only, which the build checks. */
export const MOVE_STAGE: 1 | 2 = 1

export const RECOVERY_URL = `https://${OLD_HOST}/backup`

export const TEAMS_KEY = 'stargazer.teams.saved'
export const ROSTERS_KEY = 'stargazer.rosters'

/* The stored items a hand-over carries. Any other item stays at the old
 * address. */
export const TRAVEL_KEYS = [
  TEAMS_KEY,
  ROSTERS_KEY,
  'stargazer.rosters.active',
  'stargazer.arena',
  'stargazer.season',
  'stargazer.arena.variant',
  'stargazer.teams.mode',
  'stargazer.teams.active.1v1',
  'stargazer.teams.active.3v3',
  'stargazer.teams.active.5v5',
  'stargazer.locale',
  'stargazer.prefs',
  'stargazer.skillLocale',
] as const

// Firefox refuses a link of much over 1,000,000 characters, and a refused link
// fails silently, so a longer code is not sent. The rest is room for the address.
export const MAX_CODE_LENGTH = 990_000

// Marks a hand-over in a link's `#` part; the packed data follows it.
export const LINK_MARK = '#~'

// Session item holding when this tab asked the old address for its data.
export const REQUEST_KEY = 'stargazer.recoveryRequested'
export const REQUEST_WINDOW_MS = 10 * 60 * 1000

export interface HandOverResult {
  // False when the data could not be brought over.
  ok: boolean
  // Records added to each library, and records the library had no room for.
  teams: number
  rosters: number
  teamsLeft: number
  rostersLeft: number
}

export const HAND_OVER_FAILED: HandOverResult = {
  ok: false,
  teams: 0,
  rosters: 0,
  teamsLeft: 0,
  rostersLeft: 0,
}
