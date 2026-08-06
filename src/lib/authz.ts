import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getHotel, type HotelRecord } from "@/lib/registry";
import type { Session } from "next-auth";

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session;
}

/** Loads a hotel the current session may access, or renders a 404 (not 403, to avoid
 * revealing whether a hotel ID exists to users who can't see it). */
export async function requireHotelAccess(hotelId: string): Promise<HotelRecord> {
  const session = await requireSession();
  const hotel = await getHotel(hotelId);
  if (!hotel || !canAccessHotel(session, hotelId)) {
    notFound();
  }
  return hotel;
}

export function canAccessHotel(session: Session, hotelId: string): boolean {
  const { role, hotelIds } = session.user;
  if (role === "admin") return true;
  if (hotelIds === "ALL") return true;
  return hotelIds.includes(hotelId);
}

export function isAdmin(session: Session): boolean {
  return session.user.role === "admin";
}
