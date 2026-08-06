export interface RawLogRow {
  date: string;
  time: string;
  card: string;
  encodedBy: string;
  encodedDate: string;
  encodedTime: string;
}

export type LogEntry =
  | { kind: "newGuest" }
  | { kind: "room"; room: string; variant: string; row: RawLogRow }
  | { kind: "masterKey"; label: string; row: RawLogRow };

const NEW_GUEST_PATTERN = /^new\s*guest$/i;
// A card that starts with digits (optionally followed by a suffix like
// "Copy Number 2") is a guest room. Anything else (FMK, HK, ...) is a
// master/staff key.
const LEADING_ROOM_NUMBER = /^(\d+)\s*(.*)$/;

/** Classifies a single row of a floor tab. Rows with an empty Card are New Guest dividers
 * whose Date/Time columns render as "######" in the source spreadsheet (column-too-narrow),
 * not actual data. */
export function classifyRow(row: RawLogRow): LogEntry | null {
  const card = row.card.trim();
  if (!card) return null;

  if (NEW_GUEST_PATTERN.test(card)) {
    return { kind: "newGuest" };
  }

  const match = card.match(LEADING_ROOM_NUMBER);
  if (match) {
    const room = match[1];
    const rest = match[2].trim();
    return { kind: "room", room, variant: rest.length > 0 ? rest : "Primary", row };
  }

  return { kind: "masterKey", label: card, row };
}

export interface RoomGroup {
  room: string;
  entries: Array<{ hasNewGuestBefore: boolean; row: RawLogRow; variant: string }>;
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

/** Extracts the log for a single room, in sheet order, including its New Guest dividers. */
export function getRoomLog(rows: RawLogRow[], room: string) {
  const index = buildFloorIndex(rows);
  return index.rooms.find((r) => r.room === room)?.entries ?? [];
}
