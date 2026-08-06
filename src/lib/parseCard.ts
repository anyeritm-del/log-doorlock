export interface RawLogRow {
  date: string; // A — access date/time
  time: string; // B — unused/blank in the real export; kept for column-position fidelity & dedupe
  cardType: string; // C — "Guest Card" | "Floor Card" | "Master Card" | ...
  cardNumber: string; // D — card serial (sheet header literally says "Encoded by")
  keyName: string; // E — master key name (sheet header literally says "Date")
  keyLocation: string; // F — master key coverage area (sheet header literally says "Time")
  issuer: string; // G — who issued/encoded it
  timeIssued: string; // H
  room: string; // I — explicit room number, authoritative
}

/** Maps a raw sheet row (A-I cells, as returned by readSheetRows) into a RawLogRow. */
export function rawLogRowFromCells(cells: string[]): RawLogRow {
  return {
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

export type LogEntry =
  | { kind: "newGuest" }
  | { kind: "room"; room: string; row: RawLogRow }
  | { kind: "masterKey"; label: string; row: RawLogRow };

const NEW_GUEST_PATTERN = /^new\s*guest$/i;

/** Classifies a single row of a floor tab. Room assignment reads column I directly rather than
 * guessing from the Card type — a Floor Card/Master Card row still belongs to whichever room's
 * door it opened. Only rows with no room number at all fall into the Master Keys bucket. */
export function classifyRow(row: RawLogRow): LogEntry | null {
  const cardType = row.cardType.trim();
  const room = row.room.trim();

  if (!cardType && !room) return null;

  if (NEW_GUEST_PATTERN.test(cardType)) {
    return { kind: "newGuest" };
  }

  if (room) {
    return { kind: "room", room, row };
  }

  const label = row.keyName.trim() || cardType;
  if (!label) return null;
  return { kind: "masterKey", label, row };
}

export interface RoomGroup {
  room: string;
  entries: Array<{ hasNewGuestBefore: boolean; row: RawLogRow }>;
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
      group.entries.push({ hasNewGuestBefore: pendingNewGuest, row: classified.row });
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
