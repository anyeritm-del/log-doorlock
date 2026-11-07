import type { RawLogRow } from "./parseCard";

// Month keys used by the room page's month filter:
//   "2026-10" — a row whose date has a year (Upkey, v2, v4, and v1 when its date has a year)
//   "02"      — a v1 row whose date is only "14/02" (day/month, no year)
//   "unknown" — a row whose date can't be read, so it still shows up when a month is picked

export const UNKNOWN_MONTH = "unknown";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function key(year: string | null, month: string): string | null {
  const m = parseInt(month, 10);
  if (!(m >= 1 && m <= 12)) return null;
  const mm = String(m).padStart(2, "0");
  return year ? `${year}-${mm}` : mm;
}

/** "M/D/YYYY ..." (v2 date, v4 time) → "YYYY-MM". */
function fromMonthDayYear(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})\/\d{1,2}\/(\d{4})\b/);
  return m ? key(m[2], m[1]) : null;
}

/** The month a row's access happened in, or null if its date can't be read. */
export function rowMonthKey(row: RawLogRow): string | null {
  switch (row.format) {
    case "v3": {
      const m = row.lockDate.trim().match(/^(\d{4})\/(\d{1,2})\//);
      return m ? key(m[1], m[2]) : null;
    }
    case "v2":
      return fromMonthDayYear(row.date);
    case "v4":
      return fromMonthDayYear(row.time);
    case "v1": {
      // Day/month, sometimes with a year: "14/02", "14/02/2026", "14/02/26".
      const m = row.date.trim().match(/^\d{1,2}\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
      if (!m) return null;
      const year = m[2] ? (m[2].length === 2 ? `20${m[2]}` : m[2]) : null;
      return key(year, m[1]);
    }
  }
}

/** "October 2026", or "February (no year)" for a month-only key. */
export function monthLabel(monthKey: string): string {
  if (monthKey === UNKNOWN_MONTH) return "Unknown date";
  const [a, b] = monthKey.split("-");
  if (b === undefined) return `${MONTH_NAMES[parseInt(a, 10) - 1]} (no year)`;
  return `${MONTH_NAMES[parseInt(b, 10) - 1]} ${a}`;
}

export interface MonthOption {
  key: string;
  label: string;
  count: number;
}

/** The month option a row falls under: its month, or UNKNOWN_MONTH. */
export function rowMonthOption(row: RawLogRow): string {
  return rowMonthKey(row) ?? UNKNOWN_MONTH;
}

/** The months present in the rows, newest first; month-only (no year) keys come next, and
 * "Unknown date" last. */
export function monthOptions(rows: RawLogRow[]): MonthOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = rowMonthOption(row);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rank = (k: string) => (k === UNKNOWN_MONTH ? 2 : k.includes("-") ? 0 : 1);
  return Array.from(counts, ([k, count]) => ({ key: k, label: monthLabel(k), count })).sort(
    (a, b) => rank(a.key) - rank(b.key) || b.key.localeCompare(a.key)
  );
}
