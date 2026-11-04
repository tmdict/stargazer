// Unknown or typo'd `{key}` tokens are left as-is so they render visibly instead
// of collapsing to "undefined".
export function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

// A piece of a line, `marked` where the caller sets it apart, such as a name.
export interface TextPart {
  text: string
  marked?: boolean
}

// `text` in parts, each known `{key}` token replaced by the parts given for it,
// so what goes in can be styled apart from the words around it.
export function interpolateParts(
  text: string,
  vars: Record<string, readonly TextPart[]>,
): TextPart[] {
  return text.split(/(\{\w+\})/).flatMap((piece): TextPart[] => {
    const key = piece.match(/^\{(\w+)\}$/)?.[1]
    if (key !== undefined && key in vars) return [...vars[key]!]
    return piece ? [{ text: piece }] : []
  })
}
