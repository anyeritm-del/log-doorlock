import { describe, it, expect } from "vitest";
import {
  isMasterTypeCard,
  getAccessHour,
  getEncoderName,
  isAfterHours,
  buildAuditReport,
} from "../audit";
import type { RawLogRowV1, RawLogRowV2 } from "../parseCard";

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

describe("isMasterTypeCard", () => {
  it("v1: a room-number card is not a master card", () => {
    expect(isMasterTypeCard(v1Row({ card: "100 Copy Number 1" }))).toBe(false);
  });
  it("v1: an FMK card is a master card", () => {
    expect(isMasterTypeCard(v1Row({ card: "FMK 1 (HK Floor 1)" }))).toBe(true);
  });
  it("v1: 'New Guest' is not a master card", () => {
    expect(isMasterTypeCard(v1Row({ card: "New Guest" }))).toBe(false);
  });
  it("v2: a Guest Card is not a master card", () => {
    expect(isMasterTypeCard(v2Row({ cardType: "Guest Card" }))).toBe(false);
  });
  it("v2: a Floor Card tied to a room is still a master card", () => {
    expect(isMasterTypeCard(v2Row({ cardType: "Floor Card", room: "606" }))).toBe(true);
  });
  it("v2: a Master Card with no room is a master card", () => {
    expect(isMasterTypeCard(v2Row({ cardType: "Master Card", room: "" }))).toBe(true);
  });
});

describe("getAccessHour / isAfterHours", () => {
  it("v1: parses a 24h time string", () => {
    expect(getAccessHour(v1Row({ time: "20:55" }))).toBe(20);
    expect(getAccessHour(v1Row({ time: "6:20" }))).toBe(6);
  });
  it("v2: parses noon (12 PM) as hour 12", () => {
    expect(getAccessHour(v2Row({ date: "7/31/2026 12:00:00 PM" }))).toBe(12);
  });
  it("v2: parses midnight (12 AM) as hour 0", () => {
    expect(getAccessHour(v2Row({ date: "7/31/2026 12:00:00 AM" }))).toBe(0);
  });
  it("v2: parses a PM hour correctly", () => {
    expect(getAccessHour(v2Row({ date: "7/31/2026 2:45:00 PM" }))).toBe(14);
  });
  it("flags hours >= 20 or < 7 as after-hours", () => {
    expect(isAfterHours(20)).toBe(true);
    expect(isAfterHours(23)).toBe(true);
    expect(isAfterHours(6)).toBe(true);
    expect(isAfterHours(0)).toBe(true);
    expect(isAfterHours(7)).toBe(false);
    expect(isAfterHours(19)).toBe(false);
    expect(isAfterHours(null)).toBe(false);
  });
});

describe("getEncoderName", () => {
  it("v1: returns the encodedBy field when present", () => {
    expect(getEncoderName(v1Row({ card: "100", encodedBy: "FOS ANYER" }))).toBe("FOS ANYER");
  });
  it("v1: returns null when blank", () => {
    expect(getEncoderName(v1Row({ encodedBy: "" }))).toBeNull();
  });
  it("v1: returns null for a New Guest divider row", () => {
    expect(getEncoderName(v1Row({ card: "New Guest", encodedBy: "whatever" }))).toBeNull();
  });
  it("v2: returns the issuer field when present", () => {
    expect(getEncoderName(v2Row({ issuer: "IT" }))).toBe("IT");
  });
  it("guards against column-shifted data: excludes a card-type label as encoder", () => {
    expect(getEncoderName(v1Row({ card: "100", encodedBy: "Floor Card" }))).toBeNull();
    expect(getEncoderName(v2Row({ issuer: "Guest Card" }))).toBeNull();
  });
});

describe("buildAuditReport", () => {
  it("combines after-hours master access and non-PMS encodes across floors", () => {
    const report = buildAuditReport([
      {
        floor: "1st Floor",
        rows: [
          v1Row({ card: "MK (FOM)", time: "20:55" }), // after-hours master
          v1Row({ card: "100", time: "10:00", encodedBy: "FOS ANYER" }), // in-hours, non-PMS encode
          v1Row({ card: "100", time: "10:05", encodedBy: "PMS01" }), // PMS encode, excluded
        ],
      },
      {
        floor: "6th Floor",
        rows: [
          v2Row({ cardType: "Master Card", room: "", date: "7/31/2026 6:20:00 AM", issuer: "IT" }), // after-hours + non-PMS
        ],
      },
    ]);

    expect(report.afterHoursMasterAccess).toHaveLength(2);
    expect(report.afterHoursMasterAccess[0]).toMatchObject({ floor: "1st Floor", cardLabel: "MK (FOM)" });
    expect(report.afterHoursMasterAccess[1]).toMatchObject({ floor: "6th Floor", hour: 6 });

    expect(report.nonPmsEncodes).toHaveLength(2);
    expect(report.nonPmsEncodes[0]).toMatchObject({ floor: "1st Floor", encoder: "FOS ANYER" });
    expect(report.nonPmsEncodes[1]).toMatchObject({ floor: "6th Floor", encoder: "IT" });
  });
});
