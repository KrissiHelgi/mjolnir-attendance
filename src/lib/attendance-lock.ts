/**
 * Single source of truth for attendance edit lock.
 * Lock rule: editing allowed if now <= starts_at + 1 hour (UTC).
 * Admins can always edit (override).
 */

const LOCK_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export type CanEditResult =
  | { allowed: true; locked: false }
  | { allowed: true; locked: true; isOverride: true }
  | { allowed: false; locked: true }

/**
 * Returns whether the user can edit attendance and if the record is locked.
 * Use UTC for startsAt.
 */
export function canEditAttendance(
  isAdmin: boolean,
  startsAtUtc: Date | string
): CanEditResult {
  const start = typeof startsAtUtc === 'string' ? new Date(startsAtUtc) : startsAtUtc
  const lockAt = new Date(start.getTime() + LOCK_WINDOW_MS)
  const now = new Date()
  const locked = now > lockAt

  if (isAdmin) {
    return locked ? { allowed: true, locked: true, isOverride: true } : { allowed: true, locked: false }
  }
  if (locked) {
    return { allowed: false, locked: true }
  }
  return { allowed: true, locked: false }
}

export const LOCKED_MESSAGE =
  'This class is locked. Editing allowed only within 1 hour after start.'
