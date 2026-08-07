import { readSheetRows, appendSheetRows, createHotelSpreadsheet, shareSpreadsheetWithUser } from "./googleSheets";

export type UserRole = "admin" | "staff";

export interface HotelRecord {
  hotelId: string;
  hotelName: string;
  brand: string;
  sheetId: string;
  createdAt: string;
}

export interface UserRecord {
  email: string;
  role: UserRole;
  /** Hotel IDs this user can access, or "ALL" for every hotel (implied for admins). */
  hotelIds: string[] | "ALL";
}

function getAdminSheetId(): string {
  const id = process.env.ADMIN_SHEET_ID;
  if (!id) throw new Error("ADMIN_SHEET_ID must be set. See SETUP.md.");
  return id;
}

const HOTELS_TAB = "Hotels";
const USERS_TAB = "Users";
const HOTELS_HEADER = ["hotel_id", "hotel_name", "brand", "sheet_id", "created_at"];
const USERS_HEADER = ["email", "role", "hotel_ids"];

export async function listHotels(): Promise<HotelRecord[]> {
  const rows = await readSheetRows(getAdminSheetId(), HOTELS_TAB);
  return rows.slice(1).filter(hasContent).map((r) => ({
    hotelId: r[0] ?? "",
    hotelName: r[1] ?? "",
    brand: r[2] ?? "",
    sheetId: r[3] ?? "",
    createdAt: r[4] ?? "",
  }));
}

export async function getHotel(hotelId: string): Promise<HotelRecord | null> {
  const hotels = await listHotels();
  return hotels.find((h) => h.hotelId === hotelId) ?? null;
}

export async function createHotel(hotelName: string, brand: string): Promise<HotelRecord> {
  const sheetId = await createHotelSpreadsheet(hotelName);
  const hotelId = slugify(hotelName);
  const createdAt = new Date().toISOString();

  await appendSheetRows(
    getAdminSheetId(),
    HOTELS_TAB,
    [[hotelId, hotelName, brand, sheetId, createdAt]],
    HOTELS_HEADER
  );

  return { hotelId, hotelName, brand, sheetId, createdAt };
}

export async function shareHotelSheetWithAdmin(hotelId: string, email: string): Promise<void> {
  const hotel = await getHotel(hotelId);
  if (!hotel) throw new Error(`Unknown hotel: ${hotelId}`);
  await shareSpreadsheetWithUser(hotel.sheetId, email);
}

export async function listUsers(): Promise<UserRecord[]> {
  const rows = await readSheetRows(getAdminSheetId(), USERS_TAB);
  return rows.slice(1).filter(hasContent).map(rowToUser);
}

export async function getUser(email: string): Promise<UserRecord | null> {
  const users = await listUsers();
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export async function addUser(user: UserRecord): Promise<void> {
  await appendSheetRows(
    getAdminSheetId(),
    USERS_TAB,
    [[user.email, user.role, user.hotelIds === "ALL" ? "ALL" : user.hotelIds.join(",")]],
    USERS_HEADER
  );
}

export function userCanAccessHotel(user: UserRecord, hotelId: string): boolean {
  if (user.role === "admin") return true;
  if (user.hotelIds === "ALL") return true;
  return user.hotelIds.includes(hotelId);
}

function rowToUser(r: string[]): UserRecord {
  const email = r[0] ?? "";
  const role: UserRole = r[1]?.trim().toLowerCase() === "admin" ? "admin" : "staff";
  const hotelIdsRaw = (r[2] ?? "").trim();
  const hotelIds: string[] | "ALL" =
    hotelIdsRaw.toUpperCase() === "ALL"
      ? "ALL"
      : hotelIdsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  return { email, role, hotelIds };
}

function hasContent(row: string[]): boolean {
  return row.some((cell) => (cell ?? "").trim().length > 0);
}

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
