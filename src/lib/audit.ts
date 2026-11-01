import type { RawLogRow, RawLogRowV3 } from "./parseCard";
import {
  isPrivacyDisabled,
  isPrivacyEnabled,
  isUpkeyGuestCard,
  isUpkeyStaffCard,
  upkeyHour,
} from "./upkey";

const NEW_GUEST_PATTERN = /^new\s*guest$/i;
const CARD_TYPE_LABEL_PATTERN = /^(guest|floor|master)\s*card$/i;

/** Whether a row is a master/floor-type card access — independent of classifyRow's room/masterKey
 * bucketing, since a v2 Floor Card/Master Card tied to a specific room still counts as a "master
 * card" here even though classifyRow files it under that room, not Master Keys. */
export function isMasterTypeCard(row: RawLogRow): boolean {
  // Upkey has no card types; a named staff member's card plays the master-key role.
  if (row.format === "v3") return isUpkeyStaffCard(row);
  if (row.format === "v1") {
    const card = row.card.trim();
    if (!card || NEW_GUEST_PATTERN.test(card)) return false;
    return !/^\d/.test(card);
  }
  const cardType = row.cardType.trim();
  if (!cardType || NEW_GUEST_PATTERN.test(cardType)) return false;
  return !cardType.toLowerCase().includes("guest");
}

function parseHour12(datetimeStr: string): number | null {
  const m = datetimeStr.match(/(\d{1,2}):(\d{2}):\d{2}\s*(AM|PM)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return hour;
}

function parseHour24(timeStr: string): number | null {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

/** The access hour (0-23) for a row, or null if it can't be parsed. v1 reads the `time` field
 * (24h); v2 reads the hour embedded in the `date` field's 12h+AM/PM datetime string; v3 reads
 * the 24h `lockDate`. */
export function getAccessHour(row: RawLogRow): number | null {
  switch (row.format) {
    case "v1":
      return parseHour24(row.time);
    case "v2":
      return parseHour12(row.date);
    case "v3":
      return upkeyHour(row.lockDate);
  }
}

export function isAfterHours(hour: number | null): boolean {
  return hour !== null && (hour >= 20 || hour < 7);
}

/** 00:00–04:59 — when a guest card opening the door is unusual enough to review. */
export function isEarlyMorning(hour: number | null): boolean {
  return hour !== null && hour < 5;
}

/** The name/department that encoded a row's card, or null if this row isn't a real encode event
 * (blank, a "New Guest" divider, or — guarding against column-shifted source data — a value
 * that's literally a card-type label like "Guest Card" rather than a real encoder). */
export function getEncoderName(row: RawLogRow): string | null {
  // Upkey exports don't record who encoded a card.
  if (row.format === "v3") return null;
  const cardText = row.format === "v1" ? row.card : row.cardType;
  if (NEW_GUEST_PATTERN.test(cardText.trim())) return null;

  const encoder = (row.format === "v1" ? row.encodedBy : row.issuer).trim();
  if (!encoder || CARD_TYPE_LABEL_PATTERN.test(encoder)) return null;
  return encoder;
}

function cardLabel(row: RawLogRow): string {
  switch (row.format) {
    case "v1":
      return row.card;
    case "v2":
      return row.keyName.trim() ? `${row.cardType} — ${row.keyName}` : row.cardType;
    case "v3":
      return `${row.user} — Room ${row.room}`;
  }
}

function dateTimeLabel(row: RawLogRow): string {
  switch (row.format) {
    case "v1":
      return `${row.date} ${row.time}`.trim();
    case "v2":
      return row.date;
    case "v3":
      return row.lockDate;
  }
}

export interface AfterHoursEntry {
  floor: string;
  dateTime: string;
  hour: number;
  cardLabel: string;
}

export interface NonPmsEncodeEntry {
  floor: string;
  dateTime: string;
  cardLabel: string;
  encoder: string;
}

/** Upkey only: a staff card opened the door while the guest had Privacy (Do Not Disturb) on. */
export interface StaffDuringDndEntry {
  floor: string;
  room: string;
  dateTime: string;
  user: string;
  dndSince: string;
}

/** Upkey only: a guest card opened the door between 00:00 and 04:59. */
export interface GuestEarlyMorningEntry {
  floor: string;
  room: string;
  dateTime: string;
  user: string;
}

export interface AuditReport {
  afterHoursMasterAccess: AfterHoursEntry[];
  nonPmsEncodes: NonPmsEncodeEntry[];
  staffDuringDnd: StaffDuringDndEntry[];
  guestEarlyMorning: GuestEarlyMorningEntry[];
  /** Any Upkey (v3) rows — the DND and early-morning checks only apply to these. */
  hasUpkeyData: boolean;
  /** Any v1/v2 rows — only those formats record who encoded a card (non-PMS check). */
  hasEncoderData: boolean;
}

/** Builds the after-hours-master-access and non-PMS-encode reports across every floor's rows.
 * Order is preserved per floor (sheet order, newest-first based on observed data) with floors
 * concatenated in the given order — no cross-floor date parsing/sorting. */
export function buildAuditReport(floors: Array<{ floor: string; rows: RawLogRow[] }>): AuditReport {
  const afterHoursMasterAccess: AfterHoursEntry[] = [];
  const nonPmsEncodes: NonPmsEncodeEntry[] = [];
  const staffDuringDnd: StaffDuringDndEntry[] = [];
  const guestEarlyMorning: GuestEarlyMorningEntry[] = [];
  let hasUpkeyData = false;
  let hasEncoderData = false;

  for (const { floor, rows } of floors) {
    for (const row of rows) {
      if (isMasterTypeCard(row)) {
        const hour = getAccessHour(row);
        if (isAfterHours(hour)) {
          afterHoursMasterAccess.push({
            floor,
            dateTime: dateTimeLabel(row),
            hour: hour as number,
            cardLabel: cardLabel(row),
          });
        }
      }

      const encoder = getEncoderName(row);
      if (encoder && !encoder.toLowerCase().includes("pms")) {
        nonPmsEncodes.push({ floor, dateTime: dateTimeLabel(row), cardLabel: cardLabel(row), encoder });
      }

      if (row.format === "v3") {
        hasUpkeyData = true;
        if (isUpkeyGuestCard(row) && isEarlyMorning(upkeyHour(row.lockDate))) {
          guestEarlyMorning.push({ floor, room: row.room, dateTime: row.lockDate, user: row.user });
        }
      } else {
        hasEncoderData = true;
      }
    }

    const upkeyRows = rows.filter((r): r is RawLogRowV3 => r.format === "v3");
    staffDuringDnd.push(...findStaffDuringDnd(floor, upkeyRows));
  }

  // Upkey lock dates sort correctly as text; show the newest first.
  const newestFirst = (a: { dateTime: string }, b: { dateTime: string }) =>
    b.dateTime.localeCompare(a.dateTime);
  staffDuringDnd.sort(newestFirst);
  guestEarlyMorning.sort(newestFirst);

  return {
    afterHoursMasterAccess,
    nonPmsEncodes,
    staffDuringDnd,
    guestEarlyMorning,
    hasUpkeyData,
    hasEncoderData,
  };
}

/** Replays each room's lock events in time order, tracking whether Privacy is on, and returns
 * every staff card unlock that happened while it was. */
export function findStaffDuringDnd(floor: string, rows: RawLogRowV3[]): StaffDuringDndEntry[] {
  const byRoom = new Map<string, RawLogRowV3[]>();
  for (const row of rows) {
    const list = byRoom.get(row.room) ?? [];
    list.push(row);
    byRoom.set(row.room, list);
  }

  const found: StaffDuringDndEntry[] = [];
  for (const [room, roomRows] of byRoom) {
    const ordered = [...roomRows].sort((a, b) => a.lockDate.localeCompare(b.lockDate));
    let dndSince: string | null = null;
    for (const row of ordered) {
      if (isPrivacyEnabled(row)) dndSince = row.lockDate;
      else if (isPrivacyDisabled(row)) dndSince = null;
      else if (dndSince && isUpkeyStaffCard(row)) {
        found.push({ floor, room, dateTime: row.lockDate, user: row.user, dndSince });
      }
    }
  }
  return found;
}
