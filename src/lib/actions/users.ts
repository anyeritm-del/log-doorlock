"use server";

import { requireSession, isAdmin } from "@/lib/authz";
import { addUser, listHotels, type UserRole } from "@/lib/registry";

export interface AddUserState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function addUserAction(
  _prevState: AddUserState,
  formData: FormData
): Promise<AddUserState> {
  const session = await requireSession();
  if (!isAdmin(session)) {
    return { status: "error", message: "Only admins can manage users." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "staff") as UserRole;
  const accessAll = formData.get("accessAll") === "on";
  const selectedHotelIds = formData.getAll("hotelIds").map(String);

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (role !== "admin" && role !== "staff") {
    return { status: "error", message: "Invalid role." };
  }
  if (role === "staff" && !accessAll && selectedHotelIds.length === 0) {
    return { status: "error", message: "Select at least one hotel for a staff user." };
  }

  const allHotels = await listHotels();
  const validIds = new Set(allHotels.map((h) => h.hotelId));
  const hotelIds = selectedHotelIds.filter((id) => validIds.has(id));

  await addUser({
    email,
    role,
    hotelIds: role === "admin" || accessAll ? "ALL" : hotelIds,
  });

  return { status: "success", message: `Added ${email}.` };
}
