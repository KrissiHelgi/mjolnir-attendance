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
  const known = KEY_TO_LABEL.get(key)
  if (known) return known
  if (!key) return key
  const spaced = key.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export function isValidProgramKey(key: string): boolean {
  return VALID_KEYS.has(key)
}

/** Ordered list of program keys (for dropdowns and checkboxes). */
export function getProgramKeys(): string[] {
  return PROGRAMS.map((p) => p.key)
}

/** Merge fixed PROGRAMS with custom program keys from DB (e.g. from class_templates). Use for profile checkbox list. */
export function getProgramsWithCustom(extraKeys: string[]): Array<{ key: string; label: string }> {
  const seen = new Set<string>()
  const out: Array<{ key: string; label: string }> = []
  for (const p of PROGRAMS) {
    out.push({ key: p.key, label: p.label })
    seen.add(p.key)
  }
  const custom: Array<{ key: string; label: string }> = []
  for (const key of extraKeys) {
    const k = (key ?? '').trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    custom.push({ key: k, label: getProgramLabel(k) })
  }
  custom.sort((a, b) => a.label.localeCompare(b.label))
  return [...out, ...custom]
}

/** Resolve label or key to key (for CSV/import). Case-insensitive label match. */
export function normalizeProgramKey(value: string): string | null {
  const v = value.trim()
  if (VALID_KEYS.has(v)) return v
  const lower = v.toLowerCase()
  const found = PROGRAMS.find((p) => p.label.toLowerCase() === lower)
  return found ? found.key : null
}

/** Normalize custom program name to a key (lowercase, spaces to underscores). */
export function toCustomProgramKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'custom'
}
