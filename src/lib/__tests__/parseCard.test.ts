import { describe, it, expect } from "vitest";
import { classifyRow, buildFloorIndex, type RawLogRow } from "../parseCard";

function row(overrides: Partial<RawLogRow>): RawLogRow {
  return {
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

describe("classifyRow", () => {
  it("classifies a Guest Card row by its Room column", () => {
    const result = classifyRow(row({}));
    expect(result).toMatchObject({ kind: "room", room: "606" });
  });

  it("classifies a Floor Card row tied to a room as that room's entry, not a master key", () => {
    const result = classifyRow(
      row({
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
      row({
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
    const result = classifyRow(row({ cardType: "Master Card", keyName: "", room: "" }));
    expect(result).toMatchObject({ kind: "masterKey", label: "Master Card" });
  });

  it("classifies 'New Guest' as a divider", () => {
    const result = classifyRow(row({ cardType: "New Guest", room: "" }));
    expect(result).toEqual({ kind: "newGuest" });
  });

  it("returns null for a fully blank row", () => {
    expect(classifyRow(row({ cardType: "", room: "" }))).toBeNull();
  });
});

describe("buildFloorIndex", () => {
  const rows: RawLogRow[] = [
    row({ cardType: "Master Card", keyName: "Master key HK-3", keyLocation: "SPV-2", room: "" }),
    row({ cardType: "New Guest", room: "" }),
    row({ cardType: "Guest Card", cardNumber: "109757", room: "606" }),
    row({
      cardType: "Floor Card",
      cardNumber: "105859",
      keyName: "Master Key HK-6",
      keyLocation: "Master Floor 6",
      room: "606",
    }),
    row({ cardType: "New Guest", room: "" }),
    row({ cardType: "Guest Card", cardNumber: "109633", room: "606" }),
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
    expect(room606.entries.map((e) => e.row.cardType)).toEqual([
      "Guest Card",
      "Floor Card",
      "Guest Card",
    ]);
  });

  it("attaches a New Guest divider only to the entry immediately following it", () => {
    const index = buildFloorIndex(rows);
    const room606 = index.rooms.find((r) => r.room === "606")!;
    // Guest Card (109757) follows the first New Guest; Floor Card doesn't follow one;
    // the second Guest Card (109633) follows the second New Guest.
    expect(room606.entries.map((e) => e.hasNewGuestBefore)).toEqual([true, false, true]);
  });
});
