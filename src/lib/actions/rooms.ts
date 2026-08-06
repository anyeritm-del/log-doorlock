"use server";

import { requireSession, canAccessHotel } from "@/lib/authz";
import { getHotel } from "@/lib/registry";
import { listFloorNames, addRoomsToRoster } from "@/lib/rooms";

export interface AddRoomsState {
  status: "idle" | "success" | "error";
  message?: string;
  added?: string[];
  alreadyExisted?: string[];
}

export async function addRoomsAction(
  _prevState: AddRoomsState,
  formData: FormData
): Promise<AddRoomsState> {
  const session = await requireSession();

  const hotelId = String(formData.get("hotelId") ?? "");
  if (!canAccessHotel(session, hotelId)) {
    return { status: "error", message: "You don't have access to this hotel." };
  }

  const hotel = await getHotel(hotelId);
  if (!hotel) return { status: "error", message: "Unknown hotel." };

  const floorName = String(formData.get("floorName") ?? "").trim();
  const floors = await listFloorNames(hotel.sheetId);
  if (!floors.includes(floorName)) {
    return { status: "error", message: "Unknown floor." };
  }

  const roomNumbers = String(formData.get("roomNumbers") ?? "")
    .split(/[,\n]/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (roomNumbers.length === 0) {
    return { status: "error", message: "Enter at least one room number." };
  }

  const { added, alreadyExisted } = await addRoomsToRoster(hotel.sheetId, floorName, roomNumbers);

  return {
    status: "success",
    message:
      added.length > 0
        ? `Registered ${added.length} room${added.length === 1 ? "" : "s"}.`
        : "No new rooms to register.",
    added,
    alreadyExisted,
  };
}
