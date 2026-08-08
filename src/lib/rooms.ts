import { listTabNames, readSheetRows, ensureTabExists, appendRawRows } from "@/lib/googleSheets";

export const ROOMS_TAB = "Rooms";
const ROOMS_HEADER = ["floor", "room_number", "created_at"];

export function naturalRoomSort(a: string, b: string): number {
  return a.length === b.length ? a.localeCompare(b) : a.length - b.length;
}

/** Floor tab names, excluding the reserved Rooms roster tab. */
export async function listFloorNames(spreadsheetId: string): Promise<string[]> {
  const tabs = await listTabNames(spreadsheetId);
  return tabs.filter((t) => t !== ROOMS_TAB);
}

/** The registered room numbers for a floor, deduped and naturally sorted. */
export async function listRoomRoster(spreadsheetId: string, floorName: string): Promise<string[]> {
  const tabs = await listTabNames(spreadsheetId);
  if (!tabs.includes(ROOMS_TAB)) return [];

  const rows = await readSheetRows(spreadsheetId, ROOMS_TAB);
  const rooms = rows
    .slice(1)
    .filter((r) => (r[0] ?? "").trim() === floorName)
    .map((r) => (r[1] ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(rooms)).sort(naturalRoomSort);
}

/** Registers room numbers under a floor, skipping ones already present. */
export async function addRoomsToRoster(
  spreadsheetId: string,
  floorName: string,
  roomNumbers: string[]
): Promise<{ added: string[]; alreadyExisted: string[] }> {
  await ensureTabExists(spreadsheetId, ROOMS_TAB, ROOMS_HEADER);

  const existing = new Set(await listRoomRoster(spreadsheetId, floorName));
  const unique = Array.from(new Set(roomNumbers.map((r) => r.trim()).filter(Boolean)));
  const added = unique.filter((r) => !existing.has(r));
  const alreadyExisted = unique.filter((r) => existing.has(r));

  if (added.length > 0) {
    const createdAt = new Date().toISOString();
    await appendRawRows(
      spreadsheetId,
      ROOMS_TAB,
      added.map((room) => [floorName, room, createdAt])
    );
  }

  return { added, alreadyExisted };
}
