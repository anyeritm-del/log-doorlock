import { extractTextItems } from "unpdf";
import type { RawLogRowV3 } from "./parseCard";
import { isValidLockDate, normalizeUpkeyRoom } from "./upkey";

/** A piece of text on a PDF page. y grows upwards (PDF coordinates). */
export interface PositionedText {
  str: string;
  x: number;
  y: number;
}

export interface UpkeyPdfResult {
  /** Hotel name printed under the title, e.g. "Aston Anyer". */
  hotelName: string;
  /** Room number without leading zeros, e.g. "100". */
  room: string;
  rows: RawLogRowV3[];
}

export class UpkeyPdfError extends Error {}

const TITLE = /lock\s+auditing\s*-\s*(\d+)/i;
const DATE_TIME = /\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}/;
const PAGE_LABEL = /page\s+\d+/i;
const CHECK_MARKS = /[✓✔☑]/;
const CROSS_MARKS = /[✗✘×☒]/;
// Text on the same printed line can differ slightly in y; anything within this is one line.
const LINE_TOLERANCE = 2;
// Cell text can start a little left of its column header (e.g. a centred ✓ under "Success").
const COLUMN_SLACK = 8;

type Line = PositionedText[];

function groupIntoLines(items: PositionedText[]): Line[] {
  const sorted = items
    .filter((i) => i.str.trim().length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Line[] = [];
  for (const item of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(current[0].y - item.y) <= LINE_TOLERANCE) {
      current.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
}

function lineText(line: Line): string {
  return line
    .map((i) => i.str.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Columns {
  successX: number;
  userX: number;
  lockDateX: number;
}

/** Finds the column positions from the "Record type | Success | User | Lock date" header line. */
function findColumns(line: Line): Columns | null {
  const startOf = (pattern: RegExp) => line.find((i) => pattern.test(i.str.trim()))?.x;
  const successX = startOf(/^success/i);
  const userX = startOf(/^user/i);
  const lockDateX = startOf(/^lock/i);
  if (!/record/i.test(lineText(line)) || successX === undefined || userX === undefined || lockDateX === undefined) {
    return null;
  }
  return { successX, userX, lockDateX };
}

function successValue(text: string): string {
  if (CHECK_MARKS.test(text)) return "Yes";
  if (CROSS_MARKS.test(text)) return "No";
  return "";
}

/** Parses the text of an Upkey "Lock auditing" PDF, one array of positioned text per page.
 * Kept separate from the PDF reading so it can be unit tested without a real file. */
export function parseUpkeyPages(pages: PositionedText[][]): UpkeyPdfResult {
  let room = "";
  let hotelName = "";
  const rows: RawLogRowV3[] = [];

  for (const page of pages) {
    const lines = groupIntoLines(page);
    let columns: Columns | null = null;

    for (let i = 0; i < lines.length; i++) {
      const text = lineText(lines[i]);

      const title = text.match(TITLE);
      if (title) {
        room ||= normalizeUpkeyRoom(title[1]);
        // The hotel name is printed on the line under the title, next to the print date.
        const next = lines[i + 1] ? lineText(lines[i + 1]) : "";
        hotelName ||= next.replace(DATE_TIME, "").replace(PAGE_LABEL, "").trim();
        continue;
      }

      if (!columns) {
        columns = findColumns(lines[i]);
        continue;
      }

      const cells = { recordType: [] as string[], success: [] as string[], user: [] as string[], lockDate: [] as string[] };
      for (const item of lines[i]) {
        if (item.x < columns.successX - COLUMN_SLACK) cells.recordType.push(item.str);
        else if (item.x < columns.userX - COLUMN_SLACK) cells.success.push(item.str);
        else if (item.x < columns.lockDateX - COLUMN_SLACK) cells.user.push(item.str);
        else cells.lockDate.push(item.str);
      }
      const join = (parts: string[]) => parts.join(" ").replace(/\s+/g, " ").trim();
      const lockDate = join(cells.lockDate);
      // Footer notes and anything else without a proper lock date are not log rows.
      if (!isValidLockDate(lockDate)) continue;

      rows.push({
        format: "v3",
        lockDate,
        recordType: join(cells.recordType),
        success: successValue(join(cells.success)),
        user: join(cells.user),
        room: "", // filled in below once the title has been read
      });
    }
  }

  if (!room) {
    throw new UpkeyPdfError(
      'This PDF has no "Lock auditing - <room>" title. Is it an Upkey lock audit export?'
    );
  }
  if (rows.length === 0) {
    throw new UpkeyPdfError("No lock events were found in this PDF.");
  }

  return { hotelName, room, rows: rows.map((r) => ({ ...r, room })) };
}

/** Reads an Upkey "Lock auditing" PDF export. */
export async function parseUpkeyPdf(buffer: Buffer): Promise<UpkeyPdfResult> {
  let pages: PositionedText[][];
  try {
    const { items } = await extractTextItems(new Uint8Array(buffer));
    pages = items.map((page) => page.map(({ str, x, y }) => ({ str, x, y })));
  } catch {
    throw new UpkeyPdfError("Could not read this PDF. Is the file damaged or password protected?");
  }
  return parseUpkeyPages(pages);
}

/** Whether the hotel printed in the PDF matches the hotel chosen in the app, ignoring case,
 * spacing and punctuation. Either name may be the longer one ("Aston Anyer" vs
 * "Aston Anyer Serang Hotel"). */
export function hotelNamesMatch(pdfHotel: string, appHotel: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const a = norm(pdfHotel);
  const b = norm(appHotel);
  return a !== "" && b !== "" && (a.includes(b) || b.includes(a));
}
