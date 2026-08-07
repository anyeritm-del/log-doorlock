import { describe, it, expect } from "vitest";
import {
  classifyRow,
  buildFloorIndex,
  detectSheetFormat,
  type RawLogRowV1,
  type RawLogRowV2,
} from "../parseCard";

function v1Row(overrides: Partial<RawLogRowV1> = {}): RawLogRowV1 {
  return {
    format: "v1",
    date: "14/02",
    time: "15:05",
    card: "100",
    encodedBy: "",
    encodedDate: "",
    encodedTime: "",
    ...overrides,
  };
}

function v2Row(overrides: Partial<RawLogRowV2> = {}): RawLogRowV2 {
  return {
    format: "v2",
    date: "7/31/2026 2:45:00 PM",
    time: "",
    cardType: "Guest Card",
    cardNumber: "109757",
    keyName: "",
    keyLocation: "",
    issuer: "Reception",
    timeIssued: "7/29/2026 4:24:45 PM",
    room: "606",
    ...overrides,
  };
}

describe("detectSheetFormat", () => {
  it("detects v1 from the original 6-column header", () => {
    expect(detectSheetFormat(["Date", "Time", "Card", "Encoded by", "Date", "Time"])).toBe("v1");
  });

  it("detects v2 from a 9-column header with an explicit Room column", () => {
    expect(
      detectSheetFormat([
        "Date",
        "Time",
        "Card",
        "Encoded by",
        "Date",
        "Time",
        "Issuer",
        "Time Issued",
        "Room",
      ])
    ).toBe("v2");
  });

  it("defaults to v1 for an empty or short header", () => {
    expect(detectSheetFormat([])).toBe("v1");
  });
});

describe("classifyRow (v1 — room guessed from Card text)", () => {
  it("classifies a bare room number as Primary", () => {
    const result = classifyRow(v1Row({ card: "100" }));
    expect(result).toMatchObject({ kind: "room", room: "100", variant: "Primary" });
  });

  it("classifies a room with a copy suffix", () => {
    const result = classifyRow(v1Row({ card: "100 Copy Number 1" }));
    expect(result).toMatchObject({ kind: "room", room: "100", variant: "Copy Number 1" });
  });

  it("classifies FMK entries as master keys, labeled by the raw card text", () => {
    const result = classifyRow(v1Row({ card: "FMK 1 (HK Floor 1)" }));
    expect(result).toMatchObject({ kind: "masterKey", label: "FMK 1 (HK Floor 1)" });
  });

  it("classifies 'New Guest' as a divider", () => {
    expect(classifyRow(v1Row({ card: "New Guest" }))).toEqual({ kind: "newGuest" });
  });

  it("returns null for an empty card", () => {
    expect(classifyRow(v1Row({ card: "" }))).toBeNull();
  });
});

describe("classifyRow (v2 — Room column authoritative)", () => {
  it("classifies a Guest Card row by its Room column", () => {
    const result = classifyRow(v2Row({}));
    expect(result).toMatchObject({ kind: "room", room: "606" });
  });

  it("classifies a Floor Card row tied to a room as that room's entry, not a master key", () => {
    const result = classifyRow(
      v2Row({
        cardType: "Floor Card",
        cardNumber: "105859",
        keyName: "Master Key HK-6",
        keyLocation: "Master Floor 6",
        issuer: "IT",
        room: "606",
      })
    );
    expect(result).toMatchObject({ kind: "room", room: "606" });
  });

  it("classifies a Master/Floor Card row with no room as a master key, grouped by key name", () => {
    const result = classifyRow(
      v2Row({
        cardType: "Master Card",
        cardNumber: "105865",
        keyName: "Master key HK-3",
        keyLocation: "SPV-2",
        issuer: "IT",
        room: "",
      })
    );
    expect(result).toMatchObject({ kind: "masterKey", label: "Master key HK-3" });
  });

  it("falls back to Card Type as the master key label when Key Name is blank", () => {
    const result = classifyRow(v2Row({ cardType: "Master Card", keyName: "", room: "" }));
    expect(result).toMatchObject({ kind: "masterKey", label: "Master Card" });
  });

  it("classifies 'New Guest' as a divider", () => {
    expect(classifyRow(v2Row({ cardType: "New Guest", room: "" }))).toEqual({ kind: "newGuest" });
  });

  it("returns null for a fully blank row", () => {
    expect(classifyRow(v2Row({ cardType: "", room: "" }))).toBeNull();
  });
});

describe("buildFloorIndex (v1)", () => {
  const rows: RawLogRowV1[] = [
    v1Row({ card: "FMK 1 (HK Floor 1)" }),
    v1Row({ card: "New Guest" }),
    v1Row({ card: "100 Copy Number 1" }),
    v1Row({ card: "100 Copy Number 1" }),
    v1Row({ card: "New Guest" }),
    v1Row({ card: "100" }),
  ];

  it("groups guest rooms separately from master keys", () => {
    const index = buildFloorIndex(rows);
    expect(index.rooms.map((r) => r.room)).toEqual(["100"]);
    expect(index.masterKeys.map((m) => m.label)).toEqual(["FMK 1 (HK Floor 1)"]);
  });

  it("attaches a New Guest divider only to the entry immediately following it", () => {
    const index = buildFloorIndex(rows);
    const room100 = index.rooms.find((r) => r.room === "100")!;
    expect(room100.entries.map((e) => e.hasNewGuestBefore)).toEqual([true, false, true]);
    expect(room100.entries.map((e) => e.variant)).toEqual([
      "Copy Number 1",
      "Copy Number 1",
      "Primary",
    ]);
  });
});

describe("buildFloorIndex (v2)", () => {
  const rows: RawLogRowV2[] = [
    v2Row({ cardType: "Master Card", keyName: "Master key HK-3", keyLocation: "SPV-2", room: "" }),
    v2Row({ cardType: "New Guest", room: "" }),
    v2Row({ cardType: "Guest Card", cardNumber: "109757", room: "606" }),
    v2Row({
      cardType: "Floor Card",
      cardNumber: "105859",
      keyName: "Master Key HK-6",
      keyLocation: "Master Floor 6",
      room: "606",
    }),
    v2Row({ cardType: "New Guest", room: "" }),
    v2Row({ cardType: "Guest Card", cardNumber: "109633", room: "606" }),
  ];

  it("groups rows into rooms (by Room column) and master keys (no Room) separately", () => {
    const index = buildFloorIndex(rows);
    expect(index.rooms.map((r) => r.room)).toEqual(["606"]);
    expect(index.masterKeys.map((m) => m.label)).toEqual(["Master key HK-3"]);
  });

  it("counts a Floor Card row tied to a room as part of that room's entries", () => {
    const index = buildFloorIndex(rows);
    const room606 = index.rooms.find((r) => r.room === "606")!;
    expect(room606.entries).toHaveLength(3);
    expect(room606.entries.map((e) => (e.row.format === "v2" ? e.row.cardType : null))).toEqual([
      "Guest Card",
      "Floor Card",
      "Guest Card",
    ]);
  });

  it("attaches a New Guest divider only to the entry immediately following it", () => {
    const index = buildFloorIndex(rows);
    const room606 = index.rooms.find((r) => r.room === "606")!;
    expect(room606.entries.map((e) => e.hasNewGuestBefore)).toEqual([true, false, true]);
  });
});
