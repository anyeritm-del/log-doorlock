"use server";

import { requireSession, canAccessHotel } from "@/lib/authz";
import { getHotel } from "@/lib/registry";
import { ensureTabExists, LOG_HEADER_ROW } from "@/lib/googleSheets";
import { listFloorNames, ROOMS_TAB } from "@/lib/rooms";

export interface CreateFloorState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function createFloorAction(
  _prevState: CreateFloorState,
  formData: FormData
): Promise<CreateFloorState> {
  const session = await requireSession();

  const hotelId = String(formData.get("hotelId") ?? "");
  if (!canAccessHotel(session, hotelId)) {
    return { status: "error", message: "You don't have access to this hotel." };
  }

  const hotel = await getHotel(hotelId);
  if (!hotel) return { status: "error", message: "Unknown hotel." };

  const floorName = String(formData.get("floorName") ?? "").trim();
  if (!floorName) {
    return { status: "error", message: "Enter a floor name." };
  }
  if (floorName === ROOMS_TAB) {
    return { status: "error", message: `"${ROOMS_TAB}" is a reserved name — choose another.` };
  }

  const existing = await listFloorNames(hotel.sheetId);
  if (existing.includes(floorName)) {
    return { status: "error", message: "That floor already exists." };
  }

  await ensureTabExists(hotel.sheetId, floorName, LOG_HEADER_ROW);

  return { status: "success", message: `Created ${floorName}.` };
}
