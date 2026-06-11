/**
 * Localized display name with formatted-slug fallback: the homegrown i18n's
 * t() returns the key unchanged when no translation exists.
 * e.g., ('character', 'lily-may') -> t('character.lily-may') or 'Lily May'
 */
export function localizedDisplayName(
  t: (key: string) => string,
  category: string,
  name: string,
): string {
  const key = `${category}.${name}`
  const translated = t(key)
  return translated !== key ? translated : formatDisplayName(name)
}

/**
 * Convert dash-separated names to display format with spaces
 * e.g., 'lily-may' -> 'Lily May'
 */
export function formatDisplayName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Convert dash-separated names to CamelCase for file names
 * e.g., 'lily-may' -> 'LilyMay'
 */
export function formatToCamelCase(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}
