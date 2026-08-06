import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { RawLogRow } from "./parseCard";

const HEADER_MARKERS = ["date", "time", "card", "encoded by", "encoded"];

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Excel dates arrive as JS Date objects already adjusted to the file's timezone-less date.
    const pad = (n: number) => String(n).padStart(2, "0");
    const hasTime = value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;
    return hasTime
      ? `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
      : `${pad(value.getDate())}/${pad(value.getMonth() + 1)}`;
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text ?? "");
  }
  if (typeof value === "object" && "result" in value) {
    return String((value as { result: unknown }).result ?? "");
  }
  return String(value).trim();
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const normalized = cells.map((c) => c.trim().toLowerCase());
  return HEADER_MARKERS.some((marker) => normalized.includes(marker));
}

function worksheetToRawRows(worksheet: ExcelJS.Worksheet): RawLogRow[] {
  const rows: RawLogRow[] = [];
  worksheet.eachRow((row) => {
    const cells: string[] = [];
    for (let col = 1; col <= 6; col++) {
      cells.push(cellToString(row.getCell(col).value));
    }
    if (looksLikeHeaderRow(cells)) return;
    if (cells.every((c) => c.trim().length === 0)) return;

    rows.push({
      date: cells[0] ?? "",
      time: cells[1] ?? "",
      card: cells[2] ?? "",
      encodedBy: cells[3] ?? "",
      encodedDate: cells[4] ?? "",
      encodedTime: cells[5] ?? "",
    });
  });
  return rows;
}

/** Parses an uploaded .xlsx or .csv file's first worksheet into raw log rows (A-F columns). */
export async function parseUploadedLogFile(
  buffer: Buffer,
  filename: string
): Promise<RawLogRow[]> {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const workbook = new ExcelJS.Workbook();

  if (isCsv) {
    const worksheet = await workbook.csv.read(Readable.from(buffer));
    return worksheetToRawRows(worksheet);
  }

  // exceljs's own .d.ts shadows the global Buffer type with a stale local shim
  // (`interface Buffer extends ArrayBuffer {}`) that predates newer ArrayBuffer
  // members in the "esnext" lib (resize, resizable, etc.), so a real Node Buffer
  // never structurally matches it even though it works fine at runtime.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  return worksheetToRawRows(worksheet);
}

/** Stable dedupe key for a row, used to avoid re-appending rows already present in a floor tab. */
export function rowDedupeKey(row: RawLogRow): string {
  return [row.date, row.time, row.card, row.encodedBy, row.encodedDate, row.encodedTime]
    .map((s) => s.trim().toLowerCase())
    .join("|");
}
