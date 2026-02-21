/**
 * Fixed program registry. Storage uses keys; UI displays labels.
 * Coaches filter their dashboard by selecting which program keys they coach.
 */

export const PROGRAMS = [
  { key: 'bjj', label: 'BJJ' },
  { key: 'mma', label: 'MMA' },
  { key: 'box', label: 'Box' },
  { key: 'kickbox', label: 'Kickbox' },
  { key: 'vikingathrek', label: 'Víkingaþrek' },
  { key: 'vx', label: 'VX' },
  { key: 'v6_semi_privates', label: 'V6 semi-privates' },
  { key: 'sjalfsvorn', label: 'Sjálfsvörn' },
  { key: 'heljardaetur', label: 'Heljardætur' },
  { key: 'mommuthrek', label: 'Mömmuþrek' },
] as const

const KEY_TO_LABEL = new Map<string, string>(PROGRAMS.map((p) => [p.key, p.label]))
const VALID_KEYS = new Set<string>(PROGRAMS.map((p) => p.key))

export function getProgramLabel(key: string): string {
  return KEY_TO_LABEL.get(key) ?? key
}

export function isValidProgramKey(key: string): boolean {
  return VALID_KEYS.has(key)
}

/** Ordered list of program keys (for dropdowns and checkboxes). */
export function getProgramKeys(): string[] {
  return PROGRAMS.map((p) => p.key)
}

/** Resolve label or key to key (for CSV/import). Case-insensitive label match. */
export function normalizeProgramKey(value: string): string | null {
  const v = value.trim()
  if (VALID_KEYS.has(v)) return v
  const lower = v.toLowerCase()
  const found = PROGRAMS.find((p) => p.label.toLowerCase() === lower)
  return found ? found.key : null
}
