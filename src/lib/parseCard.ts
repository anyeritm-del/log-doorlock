export type SheetFormat = "v1" | "v2" | "v3" | "v4";

/** v3 (Upkey lock audit) starts with a "Lock Date" header; v4 (per-room export) starts with
 * "Event Ord.". v2 is identified by an explicit "Room" header in the 9th column. Anything else
 * (including a missing/short header) defaults to v1, the original 6-column shape. */
export function detectSheetFormat(headerRow: string[]): SheetFormat {
  const first = (headerRow[0] ?? "").trim().toLowerCase();
  if (first === "lock date") return "v3";
  if (/^event\b/.test(first)) return "v4";
  return (headerRow[8] ?? "").trim().toLowerCase() === "room" ? "v2" : "v1";
}

export interface RawLogRowV1 {
  format: "v1";
  date: string;
  time: string;
  card: string; // full text, e.g. "100 Copy Number 1", "FMK 1 (HK Floor 1)", "New Guest"
  encodedBy: string;
  encodedDate: string;
  encodedTime: string;
}

export interface RawLogRowV2 {
  format: "v2";
  date: string; // A — access date/time
  time: string; // B — unused/blank in the real export
  cardType: string; // C — "Guest Card" | "Floor Card" | "Master Card" | ...
  cardNumber: string; // D — card serial (sheet header literally says "Encoded by")
  keyName: string; // E — master key name (sheet header literally says "Date")
  keyLocation: string; // F — master key coverage area (sheet header literally says "Time")
  issuer: string; // G — who issued/encoded it
  timeIssued: string; // H
  room: string; // I — explicit room number, authoritative
}

/** Upkey "Lock auditing" export (e.g. Aston Anyer): one PDF per room, read by upkeyPdf.ts. */
export interface RawLogRowV3 {
  format: "v3";
  lockDate: string; // A — "2026/10/30 12:58:21", 24h, sortable as text
  recordType: string; // B — "Card unlock" | "Privacy enabled" | "Privacy disabled" | ...
  success: string; // C — "Yes" | "No" | "" (unknown)
  user: string; // D — staff name, "Guest - 0100", or "Unknown" for privacy events
  room: string; // E — room number without leading zeros, e.g. "100"
}

/** Per-room door lock export (e.g. Aston Cilegon "Room 200.xlsx"), stored with the export's own
 * columns plus the room, which the export itself doesn't contain (see eventExport.ts). */
export interface RawLogRowV4 {
  format: "v4";
  eventOrd: string; // A — position in that export (1 = newest); not stable between exports
  time: string; // B — access time, "10/31/2026 9:15:00 PM"
  flag: string; // C
  cardType: string; // D — "Guest Card" | "Floor Card" | "Master Card" | ...
  cardNumber: string; // E
  holder: string; // F — guest name or master key name
  idNumber: string; // G — master key coverage, e.g. "Master Floor 2"
  issuer: string; // H — who encoded the card
  timeIssued: string; // I
  modifier: string; // J
  timeModified: string; // K
  room: string; // L — from the export's file name
}

export type RawLogRow = RawLogRowV1 | RawLogRowV2 | RawLogRowV3 | RawLogRowV4;

/** Drops banner/report-title rows — some floor tabs have a leftover row where every cell repeats
 * the same text (e.g. "Opening Record Report (809)"), which would otherwise get misclassified as
 * a bogus Master Key entry. */
export function filterJunkRows(rows: string[][]): string[][] {
  return rows.filter((row) => {
    const nonEmpty = row.filter((c) => c.trim().length > 0);
    return nonEmpty.length === 0 || !nonEmpty.every((c) => c === nonEmpty[0]);
  });
}

/** Maps a raw sheet row (positional cells, as returned by readSheetRows) into a RawLogRow of the
 * given format. v1 reads cells 0-5; v2 reads cells 0-8; v3 reads cells 0-4. */
export function rawLogRowFromCells(cells: string[], format: SheetFormat): RawLogRow {
  if (format === "v4") {
    return {
      format: "v4",
      eventOrd: cells[0] ?? "",
      time: cells[1] ?? "",
      flag: cells[2] ?? "",
      cardType: cells[3] ?? "",
      cardNumber: cells[4] ?? "",
      holder: cells[5] ?? "",
      idNumber: cells[6] ?? "",
      issuer: cells[7] ?? "",
      timeIssued: cells[8] ?? "",
      modifier: cells[9] ?? "",
      timeModified: cells[10] ?? "",
      room: cells[11] ?? "",
    };
  }
  if (format === "v3") {
    return {
      format: "v3",
      lockDate: cells[0] ?? "",
      recordType: cells[1] ?? "",
      success: cells[2] ?? "",
      user: cells[3] ?? "",
      room: cells[4] ?? "",
    };
  }
  if (format === "v1") {
    return {
      format: "v1",
      date: cells[0] ?? "",
      time: cells[1] ?? "",
      card: cells[2] ?? "",
      encodedBy: cells[3] ?? "",
      encodedDate: cells[4] ?? "",
      encodedTime: cells[5] ?? "",
    };
  }
  return {
    format: "v2",
    date: cells[0] ?? "",
    time: cells[1] ?? "",
    cardType: cells[2] ?? "",
    cardNumber: cells[3] ?? "",
    keyName: cells[4] ?? "",
    keyLocation: cells[5] ?? "",
    issuer: cells[6] ?? "",
    timeIssued: cells[7] ?? "",
    room: cells[8] ?? "",
  };
}

/** Inverse of rawLogRowFromCells — flattens a RawLogRow back into positional cells for appending. */
export function rowToCells(row: RawLogRow): string[] {
  switch (row.format) {
    case "v1":
      return [row.date, row.time, row.card, row.encodedBy, row.encodedDate, row.encodedTime];
    case "v2":
      return [
        row.date,
        row.time,
        row.cardType,
        row.cardNumber,
        row.keyName,
        row.keyLocation,
        row.issuer,
        row.timeIssued,
        row.room,
      ];
    case "v3":
      return [row.lockDate, row.recordType, row.success, row.user, row.room];
    case "v4":
      return [
        row.eventOrd,
        row.time,
        row.flag,
        row.cardType,
        row.cardNumber,
        row.holder,
        row.idNumber,
        row.issuer,
        row.timeIssued,
        row.modifier,
        row.timeModified,
        row.room,
      ];
  }
}

/** Stable dedupe key for a row, used to avoid re-appending rows already present in a floor tab.
 * v4 leaves out Event Ord., which renumbers in every new export of the same room. */
export function rowDedupeKey(row: RawLogRow): string {
  const cells = rowToCells(row);
  return (row.format === "v4" ? cells.slice(1) : cells)
    .map((s) => s.trim().toLowerCase())
    .join("|");
}

export type LogEntry =
  | { kind: "newGuest" }
  | { kind: "room"; room: string; variant?: string; row: RawLogRow }
  | { kind: "masterKey"; label: string; row: RawLogRow };

const NEW_GUEST_PATTERN = /^new\s*guest$/i;
// v1 only: a card that starts with digits (optionally followed by a suffix like
// "Copy Number 2") is a guest room. Anything else (FMK, HK, ...) is a master/staff key.
const LEADING_ROOM_NUMBER = /^(\d+)\s*(.*)$/;

/** Classifies a single row of a floor tab. v1 guesses the room from the Card text (the only
 * signal that format has); v2 reads the explicit Room column instead — a Floor Card/Master Card
 * row still belongs to whichever room's door it opened, and only a genuinely room-less row
 * becomes a Master Keys entry. */
export function classifyRow(row: RawLogRow): LogEntry | null {
  if (row.format === "v4") {
    // Every row of a per-room export belongs to that room, whatever card opened the door.
    const room = row.room.trim();
    return room && row.time.trim() ? { kind: "room", room, row } : null;
  }

  if (row.format === "v3") {
    // Every Upkey row comes from one room's lock, so it always belongs to that room.
    const room = row.room.trim();
    return room && row.recordType.trim() ? { kind: "room", room, row } : null;
  }

  if (row.format === "v1") {
    const card = row.card.trim();
    if (!card) return null;
    if (NEW_GUEST_PATTERN.test(card)) return { kind: "newGuest" };

    const match = card.match(LEADING_ROOM_NUMBER);
    if (match) {
      const room = match[1];
      const rest = match[2].trim();
      return { kind: "room", room, variant: rest.length > 0 ? rest : "Primary", row };
    }
    return { kind: "masterKey", label: card, row };
  }

  const cardType = row.cardType.trim();
  const room = row.room.trim();
  if (!cardType && !room) return null;
  if (NEW_GUEST_PATTERN.test(cardType)) return { kind: "newGuest" };
  if (room) return { kind: "room", room, row };

  const label = row.keyName.trim() || cardType;
  if (!label) return null;
  return { kind: "masterKey", label, row };
}

/** How many data rows of a tab (header first, as read from the sheet) the app can read: rows that
 * classifyRow turns into a room, master-key or New Guest entry under the tab's own format. */
export function countReadableRows(sheetRows: string[][]): number {
  const format = detectSheetFormat(sheetRows[0] ?? []);
  return filterJunkRows(sheetRows.slice(1)).filter(
    (cells) => cells.some((c) => c.trim() !== "") && classifyRow(rawLogRowFromCells(cells, format)) !== null
  ).length;
}

export interface RoomGroup {
  room: string;
  entries: Array<{ hasNewGuestBefore: boolean; row: RawLogRow; variant?: string }>;
}

export interface MasterKeyGroup {
  label: string;
  entries: Array<{ row: RawLogRow }>;
}

export interface FloorIndex {
  rooms: RoomGroup[];
  masterKeys: MasterKeyGroup[];
}

/** Builds the room list and master-key list for a floor from its raw rows, in sheet order.
 * A "New Guest" marker row is attached as a divider on whichever room/master-key row follows it. */
export function buildFloorIndex(rows: RawLogRow[]): FloorIndex {
  const roomMap = new Map<string, RoomGroup>();
  const masterKeyMap = new Map<string, MasterKeyGroup>();

  let pendingNewGuest = false;

  for (const row of rows) {
    const classified = classifyRow(row);
    if (!classified) continue;

    if (classified.kind === "newGuest") {
      pendingNewGuest = true;
      continue;
    }

    if (classified.kind === "room") {
      let group = roomMap.get(classified.room);
      if (!group) {
        group = { room: classified.room, entries: [] };
        roomMap.set(classified.room, group);
      }
      group.entries.push({
        hasNewGuestBefore: pendingNewGuest,
        row: classified.row,
        variant: classified.variant,
      });
    } else {
      let group = masterKeyMap.get(classified.label);
      if (!group) {
        group = { label: classified.label, entries: [] };
        masterKeyMap.set(classified.label, group);
      }
      group.entries.push({ row: classified.row });
    }

    pendingNewGuest = false;
  }

  const naturalRoomSort = (a: string, b: string) =>
    a.length === b.length ? a.localeCompare(b) : a.length - b.length;

  return {
    rooms: Array.from(roomMap.values()).sort((a, b) => naturalRoomSort(a.room, b.room)),
    masterKeys: Array.from(masterKeyMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
  };
}
