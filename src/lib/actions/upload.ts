"use server";

import { requireSession, canAccessHotel } from "@/lib/authz";
import { getHotel } from "@/lib/registry";
import {
  readSheetRows,
  appendSheetRows,
  listTabNames,
  LOG_HEADER_ROW,
  V1_HEADER_ROW,
  V3_HEADER_ROW,
  writeHeaderRow,
} from "@/lib/googleSheets";
import { parseUploadedFile } from "@/lib/uploadParsing";
import {
  classifyRow,
  detectSheetFormat,
  rawLogRowFromCells,
  rowToCells,
  rowDedupeKey,
  type RawLogRowV3,
} from "@/lib/parseCard";
import { addRoomsToRoster, listFloorNames, listFloorsForRoom, listRoomRoster, ROOMS_TAB } from "@/lib/rooms";
import { chooseUpkeyFloor } from "@/lib/upkey";
import { hotelNamesMatch, parseUpkeyPdf, UpkeyPdfError } from "@/lib/upkeyPdf";
import type { HotelRecord } from "@/lib/registry";

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

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a file to upload." };
  }
  if (/\.pdf$/i.test(file.name)) {
    return uploadUpkeyPdf(hotel, Buffer.from(await file.arrayBuffer()));
  }

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

  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { status: "error", message: "Only .pdf, .xlsx, .xls, or .csv files are supported." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headerRow: uploadedHeaderRow, dataRows: uploadedDataRows } = await parseUploadedFile(
    buffer,
    file.name
  );
  if (uploadedDataRows.length === 0) {
    return { status: "error", message: "No data rows found in that file." };
  }

  const existingTabs = await listTabNames(hotel.sheetId);
  const floorExists = existingTabs.includes(floorName);

  // The destination floor's own header is authoritative for how already-stored data reads
  // back; only for a brand-new floor do we fall back to the uploaded file's own header.
  const existingSheetRows = floorExists ? await readSheetRows(hotel.sheetId, floorName) : [];
  const targetFormat = floorExists
    ? detectSheetFormat(existingSheetRows[0] ?? [])
    : detectSheetFormat(uploadedHeaderRow ?? []);
  if (targetFormat === "v3") {
    return {
      status: "error",
      message: `${floorName} holds Upkey lock audit data. Upload the room's Upkey PDF instead.`,
    };
  }

  const parsedRows = uploadedDataRows.map((cells) => rawLogRowFromCells(cells, targetFormat));

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

  const existingRows = existingSheetRows.slice(1).map((cells) => rawLogRowFromCells(cells, targetFormat));
  const existingKeys = new Set(existingRows.map(rowDedupeKey));

  const newRows = acceptedRows.filter((r) => !existingKeys.has(rowDedupeKey(r)));
  if (newRows.length > 0) {
    const headerRow = targetFormat === "v1" ? V1_HEADER_ROW : LOG_HEADER_ROW;
    await appendSheetRows(hotel.sheetId, floorName, newRows.map(rowToCells), headerRow);
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

/** Imports one room's Upkey "Lock auditing" PDF. The floor is picked by chooseUpkeyFloor (the
 * room's registered floor, else a tab with the same floor number, else a new "Floor N"), and the
 * floor tab and room are created when missing. */
async function uploadUpkeyPdf(hotel: HotelRecord, buffer: Buffer): Promise<UploadState> {
  let parsed;
  try {
    parsed = await parseUpkeyPdf(buffer);
  } catch (err) {
    if (err instanceof UpkeyPdfError) return { status: "error", message: err.message };
    throw err;
  }

  // Guards against uploading one hotel's PDF into another hotel's sheet.
  if (!hotelNamesMatch(parsed.hotelName, hotel.hotelName)) {
    return {
      status: "error",
      message: `This PDF is for "${parsed.hotelName || "an unknown hotel"}", not ${hotel.hotelName}.`,
    };
  }

  const floorTabs = await listFloorNames(hotel.sheetId);
  const choice = chooseUpkeyFloor(
    parsed.room,
    floorTabs,
    await listFloorsForRoom(hotel.sheetId, parsed.room)
  );
  if ("error" in choice) return { status: "error", message: choice.error };
  const { floorName } = choice;

  const existingSheetRows = floorTabs.includes(floorName)
    ? await readSheetRows(hotel.sheetId, floorName)
    : [];
  if (existingSheetRows.length > 0 && detectSheetFormat(existingSheetRows[0]) !== "v3") {
    const hasData = existingSheetRows.slice(1).some((r) => r.some((c) => c.trim() !== ""));
    // Never mix Upkey rows into a floor tab that already holds another log format.
    if (hasData) {
      return {
        status: "error",
        message: `${floorName} already holds door lock data in another format, so Upkey rows can't be added to it.`,
      };
    }
    // A floor with only a header (e.g. created with "Add floor") can switch to Upkey safely.
    await writeHeaderRow(hotel.sheetId, floorName, V3_HEADER_ROW);
  }

  const existingKeys = new Set(
    existingSheetRows.slice(1).map((cells) => rowDedupeKey(rawLogRowFromCells(cells, "v3")))
  );
  const newRows = parsed.rows.filter((r) => !existingKeys.has(rowDedupeKey(r)));

  await addRoomsToRoster(hotel.sheetId, floorName, [parsed.room]);
  if (newRows.length > 0) {
    await appendSheetRows(hotel.sheetId, floorName, newRows.map(upkeyRowToSheetCells), V3_HEADER_ROW);
  }

  return {
    status: "success",
    message: `Uploaded Room ${parsed.room} to ${floorName}.`,
    added: newRows.length,
    skipped: parsed.rows.length - newRows.length,
    skippedUnknown: 0,
    unknownRooms: [],
  };
}

/** Rows are appended with USER_ENTERED, which would turn "2026/10/30 12:58:21" into a
 * locale-formatted date. A leading apostrophe keeps it as the original text. */
function upkeyRowToSheetCells(row: RawLogRowV3): string[] {
  const [lockDate, ...rest] = rowToCells(row);
  return [`'${lockDate}`, ...rest];
}
