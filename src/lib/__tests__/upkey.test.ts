import { describe, it, expect } from "vitest";
import { hotelNamesMatch, parseUpkeyPages, UpkeyPdfError, type PositionedText } from "../upkeyPdf";
import { chooseUpkeyFloor, floorNameForUpkeyRoom, normalizeUpkeyRoom, upkeyHour } from "../upkey";
import {
  classifyRow,
  detectSheetFormat,
  rawLogRowFromCells,
  rowDedupeKey,
  rowToCells,
  type RawLogRowV3,
} from "../parseCard";
import { buildAuditReport, getAccessHour, getEncoderName, isMasterTypeCard } from "../audit";

// Column x positions and line spacing roughly as laid out in a real Upkey "Lock auditing" PDF.
const X = { recordType: 78, success: 362, user: 450, lockDate: 621 };

function header(y: number, room = "0100", hotel = "Test Hotel"): PositionedText[] {
  return [
    { str: `Lock auditing - ${room}`, x: 376, y: y + 30 },
    { str: "Page 1", x: 793, y: y + 30 },
    { str: hotel, x: 411, y: y + 8 },
    { str: "2026/10/31 15:36:27", x: 682, y: y + 8 },
    { str: "Record type", x: X.recordType, y },
    { str: "Success", x: 357, y },
    { str: "User", x: X.user, y },
    { str: "Lock date", x: X.lockDate, y },
  ];
}

function line(y: number, recordType: string, user: string, lockDate: string, mark = "✓"): PositionedText[] {
  const items = [
    { str: recordType, x: X.recordType, y },
    { str: user, x: X.user, y },
    { str: lockDate, x: X.lockDate, y },
  ];
  return mark ? [...items, { str: mark, x: X.success, y }] : items;
}

const footer: PositionedText[] = [
  { str: "The Audit APP only shows general data.", x: 308, y: 60 },
  { str: "For a detailed audit, see the OS Access management software.", x: 221, y: 40 },
];

function v3(overrides: Partial<RawLogRowV3> = {}): RawLogRowV3 {
  return {
    format: "v3",
    lockDate: "2026/10/30 12:58:21",
    recordType: "Card unlock",
    success: "Yes",
    user: "Alex Staff HK",
    room: "100",
    ...overrides,
  };
}

describe("parseUpkeyPages", () => {
  it("reads the room, hotel and rows across pages, skipping the footer", () => {
    const page1 = [
      ...header(700),
      ...line(680, "Card unlock", "Alex Staff HK", "2026/10/30 12:58:21"),
      ...line(660, "Card unlock", "Guest - 0100", "2026/10/26 12:14:26"),
      ...line(640, "Privacy disabled", "Unknown", "2026/10/18 10:55:31"),
      ...footer,
    ];
    const page2 = [
      ...header(700),
      ...line(680, "Privacy enabled", "Unknown", "2026/10/17 20:35:03"),
      ...footer,
    ];

    const result = parseUpkeyPages([page1, page2]);

    expect(result.room).toBe("100");
    expect(result.hotelName).toBe("Test Hotel");
    expect(result.rows).toEqual([
      v3({ lockDate: "2026/10/30 12:58:21", user: "Alex Staff HK" }),
      v3({ lockDate: "2026/10/26 12:14:26", user: "Guest - 0100" }),
      v3({ lockDate: "2026/10/18 10:55:31", recordType: "Privacy disabled", user: "Unknown" }),
      v3({ lockDate: "2026/10/17 20:35:03", recordType: "Privacy enabled", user: "Unknown" }),
    ]);
  });

  it("joins text split into several pieces and tolerates slightly uneven y positions", () => {
    const page = [
      ...header(700),
      { str: "Card", x: X.recordType, y: 680 },
      { str: "unlock", x: 110, y: 680.6 },
      { str: "✓", x: X.success, y: 680 },
      { str: "Alex", x: X.user, y: 680 },
      { str: "Staff  HK", x: 480, y: 679.5 },
      { str: "2026/10/30 12:58:21", x: X.lockDate, y: 680 },
    ];
    expect(parseUpkeyPages([page]).rows).toEqual([v3()]);
  });

  it("records a cross as a failure and a missing mark as unknown", () => {
    const page = [
      ...header(700),
      ...line(680, "Card unlock", "Alex Staff HK", "2026/10/30 12:58:21", "✗"),
      ...line(660, "Card unlock", "Alex Staff HK", "2026/10/29 08:21:17", ""),
    ];
    expect(parseUpkeyPages([page]).rows.map((r) => r.success)).toEqual(["No", ""]);
  });

  it("rejects a PDF without the Lock auditing title", () => {
    const page = header(700).filter((i) => !i.str.startsWith("Lock auditing"));
    expect(() => parseUpkeyPages([page])).toThrow(UpkeyPdfError);
  });

  it("rejects a PDF with no lock events", () => {
    expect(() => parseUpkeyPages([[...header(700), ...footer]])).toThrow(/No lock events/);
  });
});

describe("Upkey room and floor rules", () => {
  it("strips leading zeros from room numbers", () => {
    expect(normalizeUpkeyRoom("0100")).toBe("100");
    expect(normalizeUpkeyRoom("1205")).toBe("1205");
    expect(normalizeUpkeyRoom("0000")).toBe("0");
  });

  it("derives the floor from the digits before the last two", () => {
    expect(floorNameForUpkeyRoom("0100")).toBe("Floor 1");
    expect(floorNameForUpkeyRoom("215")).toBe("Floor 2");
    expect(floorNameForUpkeyRoom("1205")).toBe("Floor 12");
  });

  it("uses the floor the room is already registered on", () => {
    expect(chooseUpkeyFloor("100", ["1st Floor", "2nd Floor"], ["1st Floor"])).toEqual({
      floorName: "1st Floor",
    });
  });

  it("refuses when the room is registered on more than one floor", () => {
    expect(chooseUpkeyFloor("100", ["1st Floor", "Floor 1"], ["1st Floor", "Floor 1"])).toEqual({
      error: expect.stringMatching(/more than one floor \(1st Floor, Floor 1\)/),
    });
  });

  it("otherwise follows the hotel's existing floor naming by number", () => {
    expect(chooseUpkeyFloor("100", ["1st Floor", "10th Floor"], [])).toEqual({ floorName: "1st Floor" });
    expect(chooseUpkeyFloor("1005", ["1st Floor", "10th Floor"], [])).toEqual({ floorName: "10th Floor" });
    expect(chooseUpkeyFloor("215", ["Lantai 2"], [])).toEqual({ floorName: "Lantai 2" });
  });

  it("creates Floor N when no tab matches, and refuses an ambiguous match", () => {
    expect(chooseUpkeyFloor("305", ["1st Floor"], [])).toEqual({ floorName: "Floor 3" });
    expect(chooseUpkeyFloor("100", ["1st Floor", "Floor 1"], [])).toEqual({
      error: expect.stringMatching(/More than one floor matches/),
    });
  });

  it("reads the hour from a lock date", () => {
    expect(upkeyHour("2026/10/01 23:28:07")).toBe(23);
    expect(upkeyHour("not a date")).toBeNull();
  });

  it("matches hotel names loosely in either direction", () => {
    expect(hotelNamesMatch("Aston Anyer", "Aston Anyer Serang Hotel")).toBe(true);
    expect(hotelNamesMatch("ASTON  anyer", "Aston Anyer")).toBe(true);
    expect(hotelNamesMatch("Aston Anyer", "Harper Kuta")).toBe(false);
    expect(hotelNamesMatch("", "Aston Anyer")).toBe(false);
  });
});

describe("v3 sheet format", () => {
  it("is detected from the Lock Date header without affecting v1/v2 detection", () => {
    expect(detectSheetFormat(["Lock Date", "Record Type", "Success", "User", "Room"])).toBe("v3");
    expect(detectSheetFormat(["Date", "Time", "Card", "Encoded by", "Date", "Time"])).toBe("v1");
    expect(detectSheetFormat(["Date", "", "", "", "", "", "", "", "Room"])).toBe("v2");
  });

  it("round-trips through sheet cells", () => {
    const row = v3();
    expect(rawLogRowFromCells(rowToCells(row), "v3")).toEqual(row);
    expect(rowDedupeKey(row)).toBe(rowDedupeKey(v3({ user: "ALEX STAFF HK " })));
  });

  it("files every row under its room, including privacy events", () => {
    expect(classifyRow(v3())).toEqual({ kind: "room", room: "100", row: v3() });
    const privacy = v3({ recordType: "Privacy enabled", user: "Unknown" });
    expect(classifyRow(privacy)).toEqual({ kind: "room", room: "100", row: privacy });
    expect(classifyRow(v3({ room: "" }))).toBeNull();
  });
});

describe("audit rules for v3", () => {
  it("treats named staff cards as master-type and guests/unknown as not", () => {
    expect(isMasterTypeCard(v3())).toBe(true);
    expect(isMasterTypeCard(v3({ user: "Guest - 0100" }))).toBe(false);
    expect(isMasterTypeCard(v3({ recordType: "Privacy enabled", user: "Unknown" }))).toBe(false);
  });

  it("has an access hour but no encoder", () => {
    expect(getAccessHour(v3({ lockDate: "2026/10/01 23:28:07" }))).toBe(23);
    expect(getEncoderName(v3())).toBeNull();
  });

  it("flags after-hours staff entry, staff entry during DND and early guest entry", () => {
    // Newest first, as in the PDF.
    const rows = [
      v3({ lockDate: "2026/10/17 20:35:03", recordType: "Privacy disabled", user: "Unknown" }),
      v3({ lockDate: "2026/10/17 19:30:00", user: "Alex Staff HK" }),
      v3({ lockDate: "2026/10/17 19:05:30", recordType: "Privacy enabled", user: "Unknown" }),
      v3({ lockDate: "2026/10/17 10:00:00", user: "Sam Staff FO" }),
      v3({ lockDate: "2026/10/02 03:15:00", user: "Guest - 0100" }),
      v3({ lockDate: "2026/10/01 23:28:07", user: "Sam Staff FO" }),
    ];

    const report = buildAuditReport([{ floor: "Floor 1", rows }]);

    expect(report.afterHoursMasterAccess.map((e) => e.dateTime)).toEqual(["2026/10/01 23:28:07"]);
    expect(report.afterHoursMasterAccess[0].cardLabel).toBe("Sam Staff FO — Room 100");
    expect(report.staffDuringDnd).toEqual([
      {
        floor: "Floor 1",
        room: "100",
        dateTime: "2026/10/17 19:30:00",
        user: "Alex Staff HK",
        dndSince: "2026/10/17 19:05:30",
      },
    ]);
    expect(report.guestEarlyMorning.map((e) => e.dateTime)).toEqual(["2026/10/02 03:15:00"]);
    expect(report.nonPmsEncodes).toEqual([]);
    expect(report.hasUpkeyData).toBe(true);
    expect(report.hasEncoderData).toBe(false);
  });

  it("tracks DND per room, not across rooms", () => {
    const rows = [
      v3({ room: "101", lockDate: "2026/10/17 19:00:00", recordType: "Privacy enabled", user: "Unknown" }),
      v3({ room: "102", lockDate: "2026/10/17 19:30:00", user: "Alex Staff HK" }),
    ];
    expect(buildAuditReport([{ floor: "Floor 1", rows }]).staffDuringDnd).toEqual([]);
  });
});
