/**
 * Title presets per program for Add class (weekly schedule).
 * No DB; used to populate title dropdown filtered by program.
 */

import { getProgramKeys } from '@/lib/programs'

export type ProgramKey = string

/** Weekday display labels (0 = Sunday). */
export const WEEKDAY_LABELS = ['Sun', 'Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau'] as const

export function getWeekdayLabel(weekday: number): string {
  if (weekday < 0 || weekday > 6) return String(weekday)
  return WEEKDAY_LABELS[weekday] ?? String(weekday)
}

/** Title presets per program key. Add/edit here to change dropdown options. */
export const CLASS_TITLE_PRESETS: Record<ProgramKey, string[]> = {
  bjj: ['BJJ 101', 'BJJ 201', 'Nogi 101', 'Nogi 201', 'Kids BJJ', 'Open mat'],
  mma: ['MMA 101', 'MMA 201', 'Sparring', 'Open mat'],
  box: ['Box 101', 'Box 201', 'Sparring', 'Open mat'],
  kickbox: ['Kickbox 101', 'Kickbox 201', 'Sparring', 'Open mat'],
  vikingathrek: ['Víkingaþrek', 'Víkingaþrek 2', 'Open'],
  vx: ['VX', 'VX 2', 'Open'],
  v6_semi_privates: ['Semi-private', '1:1'],
  sjalfsvorn: ['Sjálfsvörn 101', 'Sjálfsvörn 201', 'Open'],
  heljardaetur: ['Heljardætur', 'Open'],
  mommuthrek: ['Mömmuþrek', 'Open'],
}

/** Titles for a given program (presets only). Fallback to empty if program unknown. */
export function getTitlesForProgram(programKey: string): string[] {
  const list = CLASS_TITLE_PRESETS[programKey]
  if (list?.length) return list
  return []
}

/** All program keys that have at least one title preset. */
export function getProgramKeysWithTitles(): string[] {
  return getProgramKeys().filter((key) => (CLASS_TITLE_PRESETS[key]?.length ?? 0) > 0)
}
