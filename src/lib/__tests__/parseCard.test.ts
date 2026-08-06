import { describe, it, expect } from "vitest";
import { classifyRow, buildFloorIndex, type RawLogRow } from "../parseCard";

function row(card: string, overrides: Partial<RawLogRow> = {}): RawLogRow {
  return {
    date: "14/02",
    time: "15:05",
    card,
    encodedBy: "",
    encodedDate: "",
    encodedTime: "",
    ...overrides,
  };
}

describe("classifyRow", () => {
  it("classifies a bare room number as Primary", () => {
    const result = classifyRow(row("317"));
    expect(result).toEqual({ kind: "room", room: "317", variant: "Primary", row: row("317") });
  });

  it("classifies a room with a copy suffix", () => {
    const result = classifyRow(row("317 Copy Number 2"));
    expect(result).toMatchObject({ kind: "room", room: "317", variant: "Copy Number 2" });
  });

  it("classifies FMK entries as master keys", () => {
    const result = classifyRow(row("FMK  (HKS-4)"));
    expect(result).toMatchObject({ kind: "masterKey", label: "FMK  (HKS-4)" });
  });

  it("classifies FMK with a floor suffix as master key", () => {
    const result = classifyRow(row("FMK 3  (HK Floor 3.A)"));
    expect(result).toMatchObject({ kind: "masterKey", label: "FMK 3  (HK Floor 3.A)" });
  });

  it("classifies 'New Guest' as a divider", () => {
    const result = classifyRow(row("New Guest"));
    expect(result).toEqual({ kind: "newGuest" });
  });

  it("returns null for an empty card", () => {
    expect(classifyRow(row(""))).toBeNull();
  });
});

describe("buildFloorIndex", () => {
  const rows: RawLogRow[] = [
    row("FMK  (HKS-4)"),
    row("FMK 3  (HK Floor 3.A)"),
    row("New Guest"),
    row("317 Copy Number 2"),
    row("317 Copy Number 2"),
    row("New Guest"),
    row("317 Copy Number 1"),
    row("317"),
  ];

  it("groups guest rooms separately from master keys", () => {
    const index = buildFloorIndex(rows);
    expect(index.rooms.map((r) => r.room)).toEqual(["317"]);
    expect(index.masterKeys.map((m) => m.label)).toEqual([
      "FMK  (HKS-4)",
      "FMK 3  (HK Floor 3.A)",
    ]);
  });

  it("attaches a New Guest divider only to the entry immediately following it", () => {
    const index = buildFloorIndex(rows);
    const room317 = index.rooms.find((r) => r.room === "317")!;
    expect(room317.entries.map((e) => e.hasNewGuestBefore)).toEqual([
      true, // first "317 Copy Number 2" right after the first New Guest
      false, // second "317 Copy Number 2"
      true, // "317 Copy Number 1" right after the second New Guest
      false, // bare "317"
    ]);
  });

  it("preserves sheet order per room and records the variant label", () => {
    const index = buildFloorIndex(rows);
    const room317 = index.rooms.find((r) => r.room === "317")!;
    expect(room317.entries.map((e) => e.variant)).toEqual([
      "Copy Number 2",
      "Copy Number 2",
      "Copy Number 1",
      "Primary",
    ]);
  });
});
