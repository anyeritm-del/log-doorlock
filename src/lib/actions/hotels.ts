"use server";

import { requireSession, isAdmin } from "@/lib/authz";
import { createHotel, shareHotelSheetWithAdmin } from "@/lib/registry";

export interface CreateHotelState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function createHotelAction(
  _prevState: CreateHotelState,
  formData: FormData
): Promise<CreateHotelState> {
  const session = await requireSession();
  if (!isAdmin(session)) {
    return { status: "error", message: "Only admins can create hotels." };
  }

  const hotelName = String(formData.get("hotelName") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  if (!hotelName || !brand) {
    return { status: "error", message: "Hotel name and brand are required." };
  }

  const hotel = await createHotel(hotelName, brand);

  if (session.user.email) {
    // Best-effort: share the new sheet with the creating admin so they can also
    // open it directly in Google Sheets. Not fatal if it fails.
    await shareHotelSheetWithAdmin(hotel.hotelId, session.user.email).catch(() => undefined);
  }

  return { status: "success", message: `Created "${hotelName}".` };
}
