"use server";

import { requireSession, canAccessHotel } from "@/lib/authz";
import { getHotel } from "@/lib/registry";
import { readSheetRows, appendSheetRows, listTabNames, LOG_HEADER_ROW, V1_HEADER_ROW } from "@/lib/googleSheets";
import { parseUploadedFile } from "@/lib/uploadParsing";
import { classifyRow, detectSheetFormat, rawLogRowFromCells, rowToCells, rowDedupeKey } from "@/lib/parseCard";
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
