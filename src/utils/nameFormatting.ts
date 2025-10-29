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
