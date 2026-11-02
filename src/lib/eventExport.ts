import type { RawLogRowV4 } from "./parseCard";

// "Event export": a per-room door lock export (e.g. Aston Cilegon, "Room 200.xlsx") with the
// columns Event Ord. | Time | Flag | Card Type | Card No. | Holder | ID No. | Issuer | Time Issued |
// Modifier | Time Modified. It has no Room column, so the room comes from the file name. Rows are
// stored as v4: the export's own columns plus Room.

/** Hotels allowed to upload this export. Other hotels keep their existing formats untouched. */
const EVENT_EXPORT_HOTELS = ["aston cilegon", "aston serang"];

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function hotelUsesEventExport(hotelName: string): boolean {
  const name = normalize(hotelName);
  return EVENT_EXPORT_HOTELS.some((h) => name.includes(h));
}

const REQUIRED_COLUMNS = {
  time: "time",
  cardType: "card type",
  cardNumber: "card no",
  holder: "holder",
  idNumber: "id no",
  issuer: "issuer",
  timeIssued: "time issued",
} as const;

const OPTIONAL_COLUMNS = {
  flag: "flag",
  modifier: "modifier",
  timeModified: "time modified",
} as const;

type ColumnIndex = Record<keyof typeof REQUIRED_COLUMNS, number> &
  Record<keyof typeof OPTIONAL_COLUMNS, number | null>;

function columnIndex(headerRow: string[]): ColumnIndex | null {
  const names = headerRow.map(normalize);
  const index = {} as ColumnIndex;
  for (const [key, name] of Object.entries(REQUIRED_COLUMNS) as [keyof typeof REQUIRED_COLUMNS, string][]) {
    const i = names.indexOf(name);
    if (i === -1) return null;
    index[key] = i;
  }
  for (const [key, name] of Object.entries(OPTIONAL_COLUMNS) as [keyof typeof OPTIONAL_COLUMNS, string][]) {
    const i = names.indexOf(name);
    index[key] = i === -1 ? null : i;
  }
  return index;
}

/** Whether a header row is an event export: its first column starts with "Event" (the real
 * export says "Event Ord.") and it has the card columns. */
export function isEventExportHeader(headerRow: string[]): boolean {
  return /^event\b/.test(normalize(headerRow[0] ?? "")) && columnIndex(headerRow) !== null;
}

export interface EventExportTable {
  headerRow: string[];
  dataRows: string[][];
  /** Text of a title row above the header, e.g. "Opening Record Report (202)", or "". */
  title: string;
}

// Some exports put a merged title row ("Opening Record Report (202)") above the header.
const HEADER_SEARCH_ROWS = 10;

/** Finds the event export header within the first rows of a sheet, or null if this isn't one. */
export function findEventExport(rows: string[][]): EventExportTable | null {
  const limit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  for (let i = 0; i < limit; i++) {
    if (!isEventExportHeader(rows[i])) continue;
    const title = rows
      .slice(0, i)
      .flat()
      .find((c) => c.trim() !== "");
    return { headerRow: rows[i], dataRows: rows.slice(i + 1), title: title?.trim() ?? "" };
  }
  return null;
}

/** Room number from a title such as "Opening Record Report (202)". */
export function roomFromTitle(title: string): string | null {
  const m = title.match(/\((\d+)\)\s*$/);
  return m ? m[1].replace(/^0+(?=\d)/, "") : null;
}

export type ExportRoom = { room: string } | { error: string };

/** The room for an export: from the file name, else from the title row. Refuses when both are
 * present and disagree, so rows never land in the wrong room. */
export function resolveExportRoom(fileName: string, title: string): ExportRoom {
  const fromName = roomFromFileName(fileName);
  const fromTitle = roomFromTitle(title);
  if (fromName && fromTitle && fromName !== fromTitle) {
    return {
      error: `The file name says room ${fromName} but the report title says room ${fromTitle}. Check the file and upload again.`,
    };
  }
  const room = fromName ?? fromTitle;
  return room
    ? { room }
    : { error: 'This export has no Room column. Name the file after the room, e.g. "Room 200.xlsx", and upload again.' };
}

/** Room number from a file name such as "Room 200.xlsx", "room_0200.csv" or "Room-200 (1).xlsx". */
export function roomFromFileName(fileName: string): string | null {
  const m = fileName.match(/room[\s_-]*(\d+)/i);
  return m ? m[1].replace(/^0+(?=\d)/, "") : null;
}

/** Converts event export data rows to v4 rows for the given room. Rows without an access time
 * (blank lines, totals) are dropped. */
export function eventExportToRows(headerRow: string[], dataRows: string[][], room: string): RawLogRowV4[] {
  const col = columnIndex(headerRow);
  if (!col) return [];
  const cell = (row: string[], i: number | null) => (i === null ? "" : (row[i] ?? "").trim());

  return dataRows
    .filter((row) => cell(row, col.time) !== "")
    .map((row) => ({
      format: "v4",
      eventOrd: cell(row, 0),
      time: cell(row, col.time),
      flag: cell(row, col.flag),
      cardType: cell(row, col.cardType),
      cardNumber: cell(row, col.cardNumber),
      holder: cell(row, col.holder),
      idNumber: cell(row, col.idNumber),
      issuer: cell(row, col.issuer),
      timeIssued: cell(row, col.timeIssued),
      modifier: cell(row, col.modifier),
      timeModified: cell(row, col.timeModified),
      room,
    }));
}

/** Sort key for a "10/31/2026 9:15:00 PM" time: "2026-10-31 21:15:00", or "" if unparseable. */
export function eventTimeSortKey(value: string): string {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let hour = parseInt(m[4], 10) % 12;
  if (m[7].toUpperCase() === "PM") hour += 12;
  const pad = (n: string | number) => String(n).padStart(2, "0");
  return `${m[3]}-${pad(m[1])}-${pad(m[2])} ${pad(hour)}:${m[5]}:${m[6]}`;
}

/** Formats a date the way the export shows it, e.g. "10/31/2026 9:15:00 PM" (also the v2 style).
 * exceljs reads Excel date cells as UTC, so UTC fields give back the time shown in the file. */
export function formatV2DateTime(value: Date): string {
  const hours = value.getUTCHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${value.getUTCMonth() + 1}/${value.getUTCDate()}/${value.getUTCFullYear()} ` +
    `${hour12}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())} ${hours < 12 ? "AM" : "PM"}`
  );
}
