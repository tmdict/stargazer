import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { getUniqueHeroes, parseMatchData } from '@/wandwars/records/parser'
import { serializeMatches } from '@/wandwars/records/serializer'
import type { MatchResult, RecordedMatch } from '@/wandwars/types'

const PATCH = '202604_1.6.3'

// Prepends a directive so strict-mode parsing succeeds in tests not about patches.
const parse = (lines: string): MatchResult[] => parseMatchData(`// @patch ${PATCH}\n${lines}`)

const expected = (result: MatchResult['result'], weight = 1): MatchResult => ({
  left: ['a', 'b', 'c'],
  right: ['x', 'y', 'z'],
  result,
  weight,
  notes: [],
  patch: PATCH,
})

// The parser reports every skipped line through a single console.warn.
let warnSpy: MockInstance<typeof console.warn>

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
})

describe('parseMatchData', () => {
  it.each([
    ['>>', 'left', 2],
    ['>', 'left', 1],
    ['<<', 'right', 2],
    ['<', 'right', 1],
    ['=', 'draw', 1],
  ] as const)('parses %s as a %s result with weight %d', (symbol, result, weight) => {
    expect(parse(`a,b,c ${symbol} x,y,z`)).toEqual([expected(result, weight)])
  })

  it('trims whitespace around hero names', () => {
    expect(parse('a , b , c > x, y ,z')).toEqual([expected('left')])
  })

  it('extracts the note after ";" with every {hero} token, duplicates included', () => {
    const [match] = parse('a,b,c > x,y,z;{a} dove {x}, then {a} reset')
    expect(match?.notes).toEqual([
      { text: '{a} dove {x}, then {a} reset', heroes: ['a', 'x', 'a'] },
    ])
  })

  it('trims note text and drops an empty note section', () => {
    expect(parse('a,b,c > x,y,z;  spaced  ')[0]?.notes).toEqual([{ text: 'spaced', heroes: [] }])
    expect(parse('a,b,c > x,y,z;   ')[0]?.notes).toEqual([])
    expect(parse('a,b,c > x,y,z')[0]?.notes).toEqual([])
  })
})

describe('parseMatchData @patch directives', () => {
  it('strict mode skips matches before any directive with a warning', () => {
    const text = ['a,b,c > x,y,z', `// @patch ${PATCH}`, 'd,e,f > x,y,z'].join('\n')
    const matches = parseMatchData(text)
    expect(matches).toHaveLength(1)
    expect(matches[0]?.left).toEqual(['d', 'e', 'f'])
    expect(warnSpy).toHaveBeenCalledWith(
      '[WandWars Parser]',
      'Line 1: No @patch directive seen before this match (skipped)',
    )
  })

  it('lenient mode tags pre-directive matches with fallbackPatch, then the directive takes over', () => {
    const text = ['a,b,c > x,y,z', `// @patch ${PATCH}`, 'd,e,f > x,y,z'].join('\n')
    const patches = parseMatchData(text, 'fallback').map((match) => match.patch)
    expect(patches).toEqual(['fallback', PATCH])
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('a later directive switches the patch; the id is the first token after @patch', () => {
    const text = [
      `// @patch ${PATCH} @data season4.txt`,
      'a,b,c > x,y,z',
      '// @patch 202605_1.7.0',
      'd,e,f > x,y,z',
      'g,h,i > x,y,z',
    ].join('\n')
    const patches = parseMatchData(text).map((match) => match.patch)
    expect(patches).toEqual([PATCH, '202605_1.7.0', '202605_1.7.0'])
  })

  it('ignores plain // comments without clearing the current patch', () => {
    const text = [`// @patch ${PATCH}`, '// season notes', 'a,b,c > x,y,z'].join('\n')
    expect(parseMatchData(text)).toEqual([expected('left')])
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('parseMatchData malformed lines', () => {
  it.each([
    ['no result symbol', 'a,b,c x,y,z'],
    ['a symbol not space-delimited', 'a,b,c>>x,y,z'],
    ['a two-hero team', 'a,b > x,y,z'],
    ['an empty hero name', 'a,b,c > x,,z'],
    ['a four-hero team', 'a,b,c > x,y,z,w'],
  ])('skips a line with %s, leaving surrounding matches intact', (_label, badLine) => {
    const matches = parse(['a,b,c > x,y,z', badLine, 'a,b,c = x,y,z'].join('\n'))
    expect(matches).toEqual([expected('left'), expected('draw')])
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('aggregates all warnings into one console.warn citing 1-based line numbers', () => {
    parseMatchData(['a,b,c > x,y,z', '', 'garbage', `// @patch ${PATCH}`].join('\n'))
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      '[WandWars Parser]',
      'Line 1: No @patch directive seen before this match (skipped)\n' +
        'Line 3: Could not find result symbol',
    )
  })
})

describe('getUniqueHeroes', () => {
  it('returns sorted unique heroes from both sides, empty for no matches', () => {
    const matches = parse(['c,b,a > z,y,x', 'a,m,c < x,y,b'].join('\n'))
    expect(getUniqueHeroes(matches)).toEqual(['a', 'b', 'c', 'm', 'x', 'y', 'z'])
    expect(getUniqueHeroes([])).toEqual([])
  })
})

describe('parse/serialize round-trip', () => {
  // serializeMatches consumes the UI RecordedMatch shape rather than the
  // parser's MatchResult, and never emits @patch directives, so the round-trip
  // is only assertable one way: parse, map fields, serialize, and compare
  // against the match lines (directives dropped).
  const toRecorded = (match: MatchResult): RecordedMatch => ({
    left: match.left,
    right: match.right,
    winner: match.result,
    dominant: match.weight === 2,
    notes: match.notes[0]?.text ?? '',
  })

  it('serializing parsed matches reproduces every match line', () => {
    const matchLines = [
      'a,b,c >> x,y,z;sweep led by {a}',
      'a,b,c > x,y,z',
      'x,y,z << a,b,c',
      'a,b,c < x,y,z;{x} countered hard',
      'a,b,c = x,y,z',
    ]
    const text = [
      `// @patch ${PATCH}`,
      ...matchLines.slice(0, 2),
      '// @patch 202605_1.7.0',
      ...matchLines.slice(2),
    ].join('\n')

    const parsed = parseMatchData(text)
    expect(serializeMatches(parsed.map(toRecorded))).toBe(matchLines.join('\n') + '\n')
  })
})
