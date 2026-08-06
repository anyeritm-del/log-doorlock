"use server";

import { requireSession, canAccessHotel } from "@/lib/authz";
import { getHotel } from "@/lib/registry";
import { readSheetRows, appendSheetRows, listTabNames } from "@/lib/googleSheets";
import { parseUploadedLogFile, rowDedupeKey } from "@/lib/uploadParsing";
import { classifyRow, type RawLogRow } from "@/lib/parseCard";
import { listRoomRoster, ROOMS_TAB } from "@/lib/rooms";

export interface UploadState {
  status: "idle" | "success" | "error";
  message?: string;
  added?: number;
  skipped?: number;
  skippedUnknown?: number;
  unknownRooms?: string[];
}

export async function uploadLogAction(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const session = await requireSession();

  const hotelId = String(formData.get("hotelId") ?? "");
  if (!canAccessHotel(session, hotelId)) {
    return { status: "error", message: "You don't have access to this hotel." };
  }

  const hotel = await getHotel(hotelId);
  if (!hotel) return { status: "error", message: "Unknown hotel." };

  let floorName = String(formData.get("floorName") ?? "").trim();
  if (floorName === "__new__") {
    floorName = String(formData.get("newFloorName") ?? "").trim();
  }
  if (!floorName) {
    return { status: "error", message: "Choose or name a floor." };
  }
  if (floorName === ROOMS_TAB) {
    return { status: "error", message: `"${ROOMS_TAB}" is a reserved name — choose another.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a file to upload." };
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { status: "error", message: "Only .xlsx, .xls, or .csv files are supported." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsedRows = await parseUploadedLogFile(buffer, file.name);
  if (parsedRows.length === 0) {
    return { status: "error", message: "No data rows found in that file." };
  }

  // Room rows are only accepted for numbers already registered on this floor — a floor
  // with no roster (including a brand-new one) rejects all room rows, which is what
  // enforces "register rooms before uploading." Master keys and New Guest markers are
  // never validated against the roster.
  const roster = new Set(await listRoomRoster(hotel.sheetId, floorName));
  const unknownRooms = new Set<string>();
  const acceptedRows = parsedRows.filter((row) => {
    const classified = classifyRow(row);
    if (classified?.kind !== "room") return true;
    if (roster.has(classified.room)) return true;
    unknownRooms.add(classified.room);
    return false;
  });
  const skippedUnknown = parsedRows.length - acceptedRows.length;

  const existingTabs = await listTabNames(hotel.sheetId);
  const existingRows: RawLogRow[] = existingTabs.includes(floorName)
    ? (await readSheetRows(hotel.sheetId, floorName)).slice(1).map(rawFromCells)
    : [];
  const existingKeys = new Set(existingRows.map(rowDedupeKey));

  const newRows = acceptedRows.filter((r) => !existingKeys.has(rowDedupeKey(r)));
  if (newRows.length > 0) {
    await appendSheetRows(
      hotel.sheetId,
      floorName,
      newRows.map((r) => [r.date, r.time, r.card, r.encodedBy, r.encodedDate, r.encodedTime])
    );
  }

  return {
    status: "success",
    message: `Uploaded to ${floorName}.`,
    added: newRows.length,
    skipped: acceptedRows.length - newRows.length,
    skippedUnknown,
    unknownRooms: Array.from(unknownRooms).sort(),
  };
}

function rawFromCells(cells: string[]): RawLogRow {
  return {
    date: cells[0] ?? "",
    time: cells[1] ?? "",
    card: cells[2] ?? "",
    encodedBy: cells[3] ?? "",
    encodedDate: cells[4] ?? "",
    encodedTime: cells[5] ?? "",
  };
}
