import type { RawLogRowV3 } from "./parseCard";

// Rules for Upkey "Lock auditing" data (v3), e.g. Aston Anyer. One export covers one room's lock.

const GUEST_USER = /^guest\b/i;
const UNKNOWN_USER = /^unknown$/i;
const LOCK_DATE = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;

/** "0100" → "100". Keeps a single "0" for an all-zero number. */
export function normalizeUpkeyRoom(room: string): string {
  const trimmed = room.trim();
  return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, "") : trimmed;
}

/** Floor tab for a room number: the digits before the last two. "100" → "Floor 1",
 * "1205" → "Floor 12". */
export function floorNameForUpkeyRoom(room: string): string {
  const digits = normalizeUpkeyRoom(room);
  const floor = digits.length > 2 ? digits.slice(0, -2) : "0";
  return `Floor ${floor}`;
}

export function isUpkeyGuest(row: RawLogRowV3): boolean {
  return GUEST_USER.test(row.user.trim());
}

/** A card used by a named staff member — not a guest card and not an anonymous lock event. */
export function isUpkeyStaffCard(row: RawLogRowV3): boolean {
  const user = row.user.trim();
  return /card/i.test(row.recordType) && user !== "" && !GUEST_USER.test(user) && !UNKNOWN_USER.test(user);
}

export function isUpkeyGuestCard(row: RawLogRowV3): boolean {
  return /card/i.test(row.recordType) && isUpkeyGuest(row);
}

export function isPrivacyEnabled(row: RawLogRowV3): boolean {
  return /privacy\s+enabled/i.test(row.recordType);
}

export function isPrivacyDisabled(row: RawLogRowV3): boolean {
  return /privacy\s+disabled/i.test(row.recordType);
}

export function isPrivacyEvent(row: RawLogRowV3): boolean {
  return isPrivacyEnabled(row) || isPrivacyDisabled(row);
}

export function isValidLockDate(value: string): boolean {
  return LOCK_DATE.test(value.trim());
}

/** Hour 0-23 from a "2026/10/30 12:58:21" lock date, or null. */
export function upkeyHour(lockDate: string): number | null {
  const m = lockDate.trim().match(LOCK_DATE);
  return m ? parseInt(m[4], 10) : null;
}
