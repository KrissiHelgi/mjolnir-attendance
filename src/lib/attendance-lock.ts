/**
 * Single source of truth for attendance edit lock.
 * - No log yet: lock at starts_at + 24 hours (UTC).
 * - Already logged: lock at log updated_at + 2 hours.
 * Admins can always edit (override).
 */

const LOCK_AFTER_CLASS_START_MS = 24 * 60 * 60 * 1000 // 24 hours when no log yet
const LOCK_AFTER_LOG_SAVE_MS = 2 * 60 * 60 * 1000 // 2 hours after last save when log exists

export type CanEditResult =
  | { allowed: true; locked: false }
  | { allowed: true; locked: true; isOverride: true }
  | { allowed: false; locked: true }

/**
 * Returns whether the user can edit attendance and if the record is locked.
 * When logUpdatedAt is set (attendance already saved), lock 2 hours after that save.
 * Otherwise lock 24 hours after class start.
 */
export function canEditAttendance(
  isAdmin: boolean,
  startsAtUtc: Date | string,
  logUpdatedAt?: string | null
): CanEditResult {
  const now = Date.now()
  const lockAt = logUpdatedAt
    ? new Date(logUpdatedAt).getTime() + LOCK_AFTER_LOG_SAVE_MS
    : new Date(typeof startsAtUtc === 'string' ? startsAtUtc : startsAtUtc).getTime() + LOCK_AFTER_CLASS_START_MS
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
  'This class is locked. You can only edit within 24 hours of class start, or within 2 hours of the last save. Ask an admin to override.'
