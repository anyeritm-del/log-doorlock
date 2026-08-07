import ExcelJS from "exceljs";
import { Readable } from "node:stream";

const HEADER_MARKERS = ["date", "time", "card", "encoded by", "encoded", "issuer", "room"];

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

export interface ParsedUploadFile {
  /** The header row found in the file, if any — used to detect v1 vs v2 format for brand-new floors. */
  headerRow: string[] | null;
  /** Data rows as raw positional cells (A-I; blank-padded for a 6-column v1 file). */
  dataRows: string[][];
}

function worksheetToRows(worksheet: ExcelJS.Worksheet): ParsedUploadFile {
  let headerRow: string[] | null = null;
  const dataRows: string[][] = [];

  worksheet.eachRow((row) => {
    const cells: string[] = [];
    for (let col = 1; col <= 9; col++) {
      cells.push(cellToString(row.getCell(col).value));
    }
    if (cells.every((c) => c.trim().length === 0)) return;

    if (looksLikeHeaderRow(cells)) {
      headerRow ??= cells;
      return;
    }
    dataRows.push(cells);
  });

  return { headerRow, dataRows };
}

/** Parses an uploaded .xlsx or .csv file's first worksheet into raw cell rows (A-I columns).
 * Format-agnostic — the caller decides v1 vs v2 based on the header row (or the destination
 * floor's existing header, for an already-created floor) and maps cells via rawLogRowFromCells. */
export async function parseUploadedFile(buffer: Buffer, filename: string): Promise<ParsedUploadFile> {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const workbook = new ExcelJS.Workbook();

  if (isCsv) {
    const worksheet = await workbook.csv.read(Readable.from(buffer));
    return worksheetToRows(worksheet);
  }

  // exceljs's own .d.ts shadows the global Buffer type with a stale local shim
  // (`interface Buffer extends ArrayBuffer {}`) that predates newer ArrayBuffer
  // members in the "esnext" lib (resize, resizable, etc.), so a real Node Buffer
  // never structurally matches it even though it works fine at runtime.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headerRow: null, dataRows: [] };
  return worksheetToRows(worksheet);
}
