import { describe, it, expect } from "vitest";
import { monthLabel, monthOptions, rowMonthKey } from "../months";
import type { RawLogRow } from "../parseCard";

const v1 = (date: string): RawLogRow => ({
  format: "v1",
  date,
  time: "15:05",
  card: "100",
  encodedBy: "",
  encodedDate: "",
  encodedTime: "",
});
const v2 = (date: string): RawLogRow => ({
  format: "v2",
  date,
  time: "",
  cardType: "Guest Card",
  cardNumber: "1",
  keyName: "",
  keyLocation: "",
  issuer: "PMS",
  timeIssued: "",
  room: "606",
});
const v3 = (lockDate: string): RawLogRow => ({
  format: "v3",
  lockDate,
  recordType: "Card",
  success: "Yes",
  user: "Guest",
  room: "101",
});
const v4 = (time: string): RawLogRow => ({
  format: "v4",
  eventOrd: "1",
  time,
  flag: "",
  cardType: "Guest Card",
  cardNumber: "",
  holder: "",
  idNumber: "",
  issuer: "",
  timeIssued: "",
  modifier: "",
  timeModified: "",
  room: "200",
});

describe("rowMonthKey", () => {
  it("reads Upkey lock dates", () => {
    expect(rowMonthKey(v3("2026/10/30 12:58:21"))).toBe("2026-10");
  });
  it("reads v2 and v4 month/day/year dates", () => {
    expect(rowMonthKey(v2("7/31/2026 2:45:00 PM"))).toBe("2026-07");
    expect(rowMonthKey(v4("12/1/2025 9:15:00 PM"))).toBe("2025-12");
  });
  it("reads v1 day/month dates, with or without a year", () => {
    expect(rowMonthKey(v1("14/02"))).toBe("02");
    expect(rowMonthKey(v1("14/02/2026"))).toBe("2026-02");
    expect(rowMonthKey(v1("14/02/26"))).toBe("2026-02");
  });
  it("returns null for unreadable or impossible dates", () => {
    expect(rowMonthKey(v1(""))).toBeNull();
    expect(rowMonthKey(v1("14/13"))).toBeNull();
    expect(rowMonthKey(v3("bad"))).toBeNull();
  });
});

describe("monthLabel", () => {
  it("names the month", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthLabel("02")).toBe("February (no year)");
  });
});

describe("monthOptions", () => {
  it("counts rows per month: newest first, then month-only, then unknown", () => {
    const opts = monthOptions([
      v3("2026/09/01 10:00:00"),
      v3("2026/10/30 12:58:21"),
      v3("2026/10/02 08:00:00"),
      v1("14/02"),
      v3("bad"),
    ]);
    expect(opts).toEqual([
      { key: "2026-10", label: "October 2026", count: 2 },
      { key: "2026-09", label: "September 2026", count: 1 },
      { key: "02", label: "February (no year)", count: 1 },
      { key: "unknown", label: "Unknown date", count: 1 },
    ]);
  });
});
