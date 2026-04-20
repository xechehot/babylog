import type { EntryType } from '../../types'

export const TYPE_LABELS: Record<EntryType, string> = {
  feeding: 'Feeding',
  diaper: 'Diaper',
  weight: 'Weight',
}

export const SUBTYPE_LABELS: Record<string, string> = {
  breast: 'Breast',
  formula: 'Formula',
  pee: 'Pee',
  poo: 'Poo',
  dry: 'Dry',
  'pee+poo': 'Pee+Poo',
}

export const SUBTYPE_ICONS: Record<string, string> = {
  breast: '\u{1F930}',
  formula: '\u{1F37C}',
  pee: '\u{1F4A7}',
  poo: '\u{1F4A9}',
  dry: '\u{2705}',
  'pee+poo': '\u{1F4A7}\u{1F4A9}',
}

export function getEntryIcon(entryType: string, subtype: string | null): string {
  if (subtype && SUBTYPE_ICONS[subtype]) {
    return SUBTYPE_ICONS[subtype]
  }
  if (entryType === 'weight') return '\u{2696}\u{FE0F}'
  if (entryType === 'feeding') return '\u{1F37C}'
  if (entryType === 'diaper') return '\u{1FA7B}'
  return ''
}

export const FEEDING_SUBTYPES = ['breast', 'formula'] as const
export const DIAPER_SUBTYPES = ['pee', 'poo', 'dry', 'pee+poo'] as const
