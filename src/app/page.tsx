import Link from "next/link";
import { requireSession } from "@/lib/authz";
import { listHotels } from "@/lib/registry";

export default async function HomePage() {
  const session = await requireSession();
  const allHotels = await listHotels();
  const hotels =
    session.user.role === "admin" || session.user.hotelIds === "ALL"
      ? allHotels
      : allHotels.filter((h) => session.user.hotelIds.includes(h.hotelId));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Your hotels</h1>
      {hotels.length === 0 && (
        <p className="text-sm text-gray-600">
          No hotels are assigned to your account yet. Contact an admin.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {hotels.map((hotel) => (
          <li key={hotel.hotelId}>
            <Link
              href={`/hotel/${hotel.hotelId}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-400"
            >
              <div className="font-medium">{hotel.hotelName}</div>
              <div className="text-sm text-gray-500">{hotel.brand}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
