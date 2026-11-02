import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  eventExportToRows,
  eventTimeSortKey,
  findEventExport,
  formatV2DateTime,
  hotelUsesEventExport,
  isEventExportHeader,
  resolveExportRoom,
  roomFromFileName,
} from "../eventExport";
import { parseUploadedTable } from "../uploadParsing";
import {
  classifyRow,
  detectSheetFormat,
  rawLogRowFromCells,
  rowDedupeKey,
  rowToCells,
  type RawLogRowV4,
} from "../parseCard";
import { buildAuditReport, getAccessHour, getEncoderName, isMasterTypeCard } from "../audit";

// As in Aston Cilegon's real "Room 200.xlsx" export.
const HEADER = [
  "Event Ord.",
  "Time",
  "Flag",
  "Card Type",
  "Card No.",
  "Holder",
  "ID No.",
  "Issuer",
  "Time Issued",
  "Modifier",
  "Time Modified",
];

const V4_HEADER = [...HEADER, "Room"];

function v4(overrides: Partial<RawLogRowV4> = {}): RawLogRowV4 {
  return {
    format: "v4",
    eventOrd: "1",
    time: "11/1/2026 9:28:00 AM",
    flag: "",
    cardType: "Master Card",
    cardNumber: "112348",
    holder: "Master Key HK-2",
    idNumber: "SPV-1",
    issuer: "IT",
    timeIssued: "9/1/2026 8:31:11 AM",
    modifier: "",
    timeModified: "",
    room: "200",
    ...overrides,
  };
}

describe("event export detection", () => {
  it("recognises the per-room export header", () => {
    expect(isEventExportHeader(HEADER)).toBe(true);
    expect(isEventExportHeader(["Event", ...HEADER.slice(1)])).toBe(true);
    expect(isEventExportHeader(["Eventually", ...HEADER.slice(1)])).toBe(false);
  });

  it("does not match the v1 or v2 log headers", () => {
    expect(isEventExportHeader(["Date", "Time", "Card", "Encoded by", "Date", "Time"])).toBe(false);
    expect(
      isEventExportHeader(["Date", "Time", "Card", "Encoded by", "Date", "Time", "Issuer", "Time Issued", "Room"])
    ).toBe(false);
  });

  it("reads the room from the file name", () => {
    expect(roomFromFileName("Room 200.xlsx")).toBe("200");
    expect(roomFromFileName("room_0215.csv")).toBe("215");
    expect(roomFromFileName("Room-200 (1).xlsx")).toBe("200");
    expect(roomFromFileName("export.xlsx")).toBeNull();
  });

  it("is only enabled for Aston Cilegon and Aston Serang", () => {
    expect(hotelUsesEventExport("Aston Cilegon Boutique Hotel")).toBe(true);
    expect(hotelUsesEventExport("ASTON Serang Hotel & Convention Center")).toBe(true);
    expect(hotelUsesEventExport("Aston Anyer Beach Hotel")).toBe(false);
    expect(hotelUsesEventExport("Harper Cikarang")).toBe(false);
  });
});

describe("eventExportToRows", () => {
  const rows = [
    ["1", "11/1/2026 9:28:00 AM", "", "Master Card", "112348", "Master Key HK-2", "SPV-1", "IT", "9/1/2026 8:31:11 AM", "", ""],
    ["2", "10/31/2026 9:15:00 PM", "", "Guest Card", "116834", "Test Guest", "", "PMS02", "10/31/2026 9:11:06 PM", "", ""],
    ["", "", "", "", "", "", "", "", "", "", ""],
  ];

  it("keeps every export column, adds the room and drops rows without a time", () => {
    expect(eventExportToRows(HEADER, rows, "200")).toEqual([
      v4(),
      v4({
        eventOrd: "2",
        time: "10/31/2026 9:15:00 PM",
        cardType: "Guest Card",
        cardNumber: "116834",
        holder: "Test Guest",
        idNumber: "",
        issuer: "PMS02",
        timeIssued: "10/31/2026 9:11:06 PM",
      }),
    ]);
  });

  it("works when optional columns are missing", () => {
    const header = HEADER.filter((h) => !["Flag", "Modifier", "Time Modified"].includes(h));
    const row = ["1", "11/1/2026 9:28:00 AM", "Master Card", "112348", "Master Key HK-2", "SPV-1", "IT", "9/1/2026 8:31:11 AM"];
    expect(eventExportToRows(header, [row], "200")).toEqual([v4()]);
  });
});

describe("v4 sheet format", () => {
  it("is detected from the Event Ord. header without affecting the other formats", () => {
    expect(detectSheetFormat(V4_HEADER)).toBe("v4");
    expect(detectSheetFormat(["Lock Date", "Record Type", "Success", "User", "Room"])).toBe("v3");
    expect(detectSheetFormat(["Date", "Time", "Card", "Encoded by", "Date", "Time"])).toBe("v1");
  });

  it("round-trips through sheet cells in the export's column order plus Room", () => {
    const row = v4();
    expect(rowToCells(row)).toEqual([
      "1", "11/1/2026 9:28:00 AM", "", "Master Card", "112348", "Master Key HK-2", "SPV-1", "IT",
      "9/1/2026 8:31:11 AM", "", "", "200",
    ]);
    expect(rawLogRowFromCells(rowToCells(row), "v4")).toEqual(row);
  });

  it("ignores Event Ord. when finding duplicates, since every export renumbers", () => {
    expect(rowDedupeKey(v4({ eventOrd: "1" }))).toBe(rowDedupeKey(v4({ eventOrd: "37" })));
    expect(rowDedupeKey(v4())).not.toBe(rowDedupeKey(v4({ time: "11/1/2026 9:29:00 AM" })));
  });

  it("files every row under its room", () => {
    expect(classifyRow(v4())).toEqual({ kind: "room", room: "200", row: v4() });
    expect(classifyRow(v4({ room: "" }))).toBeNull();
  });
});

describe("audit rules for v4", () => {
  it("treats master and floor cards as master-type, reads the 12h hour and the issuer", () => {
    expect(isMasterTypeCard(v4())).toBe(true);
    expect(isMasterTypeCard(v4({ cardType: "Floor Card" }))).toBe(true);
    expect(isMasterTypeCard(v4({ cardType: "Guest Card" }))).toBe(false);
    expect(getAccessHour(v4({ time: "10/31/2026 9:15:00 PM" }))).toBe(21);
    expect(getEncoderName(v4({ issuer: "Reception" }))).toBe("Reception");
  });

  it("reports after-hours master access and non-PMS encodes", () => {
    const report = buildAuditReport([
      {
        floor: "2nd Floor",
        rows: [
          v4({ time: "10/30/2026 10:15:00 PM", cardType: "Floor Card", holder: "Master Key HK-2" }),
          v4({ time: "10/30/2026 2:00:00 PM", cardType: "Guest Card", issuer: "PMS02" }),
        ],
      },
    ]);
    expect(report.afterHoursMasterAccess).toEqual([
      { floor: "2nd Floor", dateTime: "10/30/2026 10:15:00 PM", hour: 22, cardLabel: "Floor Card — Master Key HK-2" },
    ]);
    expect(report.nonPmsEncodes.map((e) => e.encoder)).toEqual(["IT"]);
    expect(report.hasEncoderData).toBe(true);
  });
});

describe("time helpers", () => {
  it("formats Excel dates in the export's 12-hour style using UTC fields", () => {
    expect(formatV2DateTime(new Date(Date.UTC(2026, 9, 31, 21, 15, 0)))).toBe("10/31/2026 9:15:00 PM");
    expect(formatV2DateTime(new Date(Date.UTC(2026, 10, 1, 0, 5, 9)))).toBe("11/1/2026 12:05:09 AM");
    expect(formatV2DateTime(new Date(Date.UTC(2026, 10, 1, 12, 0, 0)))).toBe("11/1/2026 12:00:00 PM");
  });

  it("builds sortable keys so 10:00 AM sorts before 9:00 PM on the same day", () => {
    expect(eventTimeSortKey("10/31/2026 9:15:00 PM")).toBe("2026-10-31 21:15:00");
    expect(eventTimeSortKey("11/1/2026 12:05:09 AM")).toBe("2026-11-01 00:05:09");
    expect(eventTimeSortKey("not a time")).toBe("");
  });
});

describe("parseUploadedTable", () => {
  it("reads an .xlsx event export with real Excel date cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(HEADER);
    sheet.addRow([
      1,
      new Date(Date.UTC(2026, 10, 1, 9, 28, 0)),
      "",
      "Master Card",
      112348,
      "Master Key HK-2",
      "SPV-1",
      "IT",
      new Date(Date.UTC(2026, 8, 1, 8, 31, 11)),
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const table = findEventExport(await parseUploadedTable(buffer, "Room 200.xlsx"));

    expect(table).not.toBeNull();
    expect(eventExportToRows(table!.headerRow, table!.dataRows, "200")).toEqual([v4()]);
  });
});

describe("findEventExport and room resolution", () => {
  const row = ["1", "11/1/2026 10:53:00 AM", "", "Master Card", "112348", "Master Key HK-2", "SPV-1", "IT", "9/1/2026 8:31:11 AM", "", ""];

  it("finds the header below a merged title row, as in the Room 202 export", () => {
    const title = Array(11).fill("Opening Record Report (202)");
    expect(findEventExport([title, HEADER, row])).toEqual({
      headerRow: HEADER,
      dataRows: [row],
      title: "Opening Record Report (202)",
    });
  });

  it("finds a header in the first row with no title", () => {
    expect(findEventExport([HEADER, row])).toEqual({ headerRow: HEADER, dataRows: [row], title: "" });
  });

  it("returns null for files without the export header", () => {
    expect(findEventExport([["Date", "Time", "Card", "Encoded by", "Date", "Time"], row])).toBeNull();
  });

  it("takes the room from the file name, else the title, and refuses a mismatch", () => {
    expect(resolveExportRoom("Room 202.xlsx", "Opening Record Report (202)")).toEqual({ room: "202" });
    expect(resolveExportRoom("export.xlsx", "Opening Record Report (0202)")).toEqual({ room: "202" });
    expect(resolveExportRoom("Room 200.xlsx", "")).toEqual({ room: "200" });
    expect(resolveExportRoom("Room 200.xlsx", "Opening Record Report (202)")).toEqual({
      error: expect.stringMatching(/file name says room 200 but the report title says room 202/),
    });
    expect(resolveExportRoom("export.xlsx", "")).toEqual({ error: expect.stringMatching(/no Room column/) });
  });
});
