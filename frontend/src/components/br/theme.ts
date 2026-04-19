export const BR = {
  ink: '#06080a',
  char: '#0b0f12',
  char2: '#10161b',
  line: 'rgba(215,170,110,0.14)',
  lineStrong: 'rgba(215,170,110,0.28)',
  dim: 'rgba(215,200,180,0.38)',
  body: 'rgba(240,225,200,0.78)',
  text: '#f0e3cc',
  amber: '#ffb347',
  amberGlow: 'rgba(255,179,71,0.55)',
  cyan: '#64f0e8',
  cyanGlow: 'rgba(100,240,232,0.4)',
  blood: '#ff4d4d',
  rose: '#ff9ea3',
  stool: '#b8946a',
  stoolGlow: 'rgba(184,148,106,0.5)',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  display: '"Unbounded", "JetBrains Mono", ui-monospace, monospace',
  serif: '"Cormorant Garamond", serif',
  hand: '"Caveat", cursive',
} as const

export const ENTRY_COLOR: Record<string, string> = {
  feeding: BR.amber,
  breast: BR.rose,
  formula: BR.amber,
  diaper: BR.cyan,
  pee: BR.cyan,
  poo: BR.stool,
  'pee+poo': BR.stool,
  dry: BR.dim.replace('0.38', '0.7'),
  weight: BR.rose,
}

export function entryAccent(entryType: string, subtype?: string | null): string {
  if (subtype && ENTRY_COLOR[subtype]) return ENTRY_COLOR[subtype]
  return ENTRY_COLOR[entryType] ?? BR.amber
}

export function entryGlyph(entryType: string, subtype?: string | null): string {
  if (subtype === 'breast') return 'B'
  if (subtype === 'formula') return 'F'
  if (subtype === 'pee') return 'P'
  if (subtype === 'poo') return 'K'
  if (subtype === 'pee+poo') return 'PK'
  if (subtype === 'dry') return 'D'
  if (entryType === 'weight') return 'W'
  if (entryType === 'feeding') return 'F'
  if (entryType === 'diaper') return 'D'
  return '·'
}
