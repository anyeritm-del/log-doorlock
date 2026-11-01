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

/** Floor number for a room: the digits before the last two. "100" → 1, "1205" → 12. */
export function floorNumberForUpkeyRoom(room: string): number {
  const digits = normalizeUpkeyRoom(room);
  return digits.length > 2 ? parseInt(digits.slice(0, -2), 10) : 0;
}

/** Default name for a floor tab the app has to create, e.g. "Floor 1". */
export function floorNameForUpkeyRoom(room: string): string {
  return `Floor ${floorNumberForUpkeyRoom(room)}`;
}

export type UpkeyFloorChoice = { floorName: string } | { error: string };

/** Picks the floor tab for an Upkey room, following the hotel's own naming:
 * 1. the floor the room is already registered on (Rooms tab);
 * 2. else the one existing floor tab with the same number ("1st Floor", "Floor 1", "Lantai 1");
 * 3. else a new "Floor N" tab. */
export function chooseUpkeyFloor(
  room: string,
  floorTabs: string[],
  floorsWithRoom: string[]
): UpkeyFloorChoice {
  const registered = Array.from(new Set(floorsWithRoom));
  if (registered.length === 1) return { floorName: registered[0] };
  if (registered.length > 1) {
    return {
      error: `Room ${room} is registered on more than one floor (${registered.join(", ")}). Remove the wrong one from the Rooms tab in the hotel's Google Sheet, then upload again.`,
    };
  }

  const floorNumber = floorNumberForUpkeyRoom(room);
  const sameNumber = floorTabs.filter((tab) =>
    (tab.match(/\d+/g) ?? []).some((n) => parseInt(n, 10) === floorNumber)
  );
  if (sameNumber.length === 1) return { floorName: sameNumber[0] };
  if (sameNumber.length > 1) {
    return {
      error: `More than one floor matches room ${room} (${sameNumber.join(", ")}). Register room ${room} on the right floor first, then upload again.`,
    };
  }
  return { floorName: floorNameForUpkeyRoom(room) };
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
