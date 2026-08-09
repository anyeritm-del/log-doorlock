import type { RawLogRow } from "./parseCard";

const NEW_GUEST_PATTERN = /^new\s*guest$/i;
const CARD_TYPE_LABEL_PATTERN = /^(guest|floor|master)\s*card$/i;

/** Whether a row is a master/floor-type card access — independent of classifyRow's room/masterKey
 * bucketing, since a v2 Floor Card/Master Card tied to a specific room still counts as a "master
 * card" here even though classifyRow files it under that room, not Master Keys. */
export function isMasterTypeCard(row: RawLogRow): boolean {
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
 * (24h); v2 reads the hour embedded in the `date` field's 12h+AM/PM datetime string. */
export function getAccessHour(row: RawLogRow): number | null {
  return row.format === "v1" ? parseHour24(row.time) : parseHour12(row.date);
}

export function isAfterHours(hour: number | null): boolean {
  return hour !== null && (hour >= 20 || hour < 7);
}

/** The name/department that encoded a row's card, or null if this row isn't a real encode event
 * (blank, a "New Guest" divider, or — guarding against column-shifted source data — a value
 * that's literally a card-type label like "Guest Card" rather than a real encoder). */
export function getEncoderName(row: RawLogRow): string | null {
  const cardText = row.format === "v1" ? row.card : row.cardType;
  if (NEW_GUEST_PATTERN.test(cardText.trim())) return null;

  const encoder = (row.format === "v1" ? row.encodedBy : row.issuer).trim();
  if (!encoder || CARD_TYPE_LABEL_PATTERN.test(encoder)) return null;
  return encoder;
}

function cardLabel(row: RawLogRow): string {
  if (row.format === "v1") return row.card;
  return row.keyName.trim() ? `${row.cardType} — ${row.keyName}` : row.cardType;
}

function dateTimeLabel(row: RawLogRow): string {
  return row.format === "v1" ? `${row.date} ${row.time}`.trim() : row.date;
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

export interface AuditReport {
  afterHoursMasterAccess: AfterHoursEntry[];
  nonPmsEncodes: NonPmsEncodeEntry[];
}

/** Builds the after-hours-master-access and non-PMS-encode reports across every floor's rows.
 * Order is preserved per floor (sheet order, newest-first based on observed data) with floors
 * concatenated in the given order — no cross-floor date parsing/sorting. */
export function buildAuditReport(floors: Array<{ floor: string; rows: RawLogRow[] }>): AuditReport {
  const afterHoursMasterAccess: AfterHoursEntry[] = [];
  const nonPmsEncodes: NonPmsEncodeEntry[] = [];

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
    }
  }

  return { afterHoursMasterAccess, nonPmsEncodes };
}
