export type SheetFormat = "v1" | "v2";

/** v2 is identified by an explicit "Room" header in the 9th column; anything else (including a
 * missing/short header) defaults to v1, the original 6-column shape. */
export function detectSheetFormat(headerRow: string[]): SheetFormat {
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

export type RawLogRow = RawLogRowV1 | RawLogRowV2;

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
 * given format. v1 reads cells 0-5; v2 reads cells 0-8. */
export function rawLogRowFromCells(cells: string[], format: SheetFormat): RawLogRow {
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
  return row.format === "v1"
    ? [row.date, row.time, row.card, row.encodedBy, row.encodedDate, row.encodedTime]
    : [
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
}

/** Stable dedupe key for a row, used to avoid re-appending rows already present in a floor tab. */
export function rowDedupeKey(row: RawLogRow): string {
  const fields =
    row.format === "v1"
      ? [row.date, row.time, row.card, row.encodedBy, row.encodedDate, row.encodedTime]
      : [
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
  return fields.map((s) => s.trim().toLowerCase()).join("|");
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
