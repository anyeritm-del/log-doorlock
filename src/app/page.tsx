import Link from "next/link";
import { requireSession } from "@/lib/authz";
import { listHotels } from "@/lib/registry";
import { EmptyState, PageHeader, linkCardClass } from "@/components/ui";

export default async function HomePage() {
  const session = await requireSession();
  const allHotels = await listHotels();
  const hotels =
    session.user.role === "admin" || session.user.hotelIds === "ALL"
      ? allHotels
      : allHotels.filter((h) => session.user.hotelIds.includes(h.hotelId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your hotels"
        subtitle="Select a hotel to view floors, room access history and security reports."
      />
      {hotels.length === 0 && (
        <EmptyState>No hotels are assigned to your account yet. Contact an admin.</EmptyState>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hotels.map((hotel) => (
          <li key={hotel.hotelId}>
            <Link
              href={`/hotel/${hotel.hotelId}`}
              className={`${linkCardClass} group flex items-center gap-4 p-5`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-lg font-bold text-brand">
                {hotel.hotelName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-gray-900">{hotel.hotelName}</span>
                <span className="block text-sm text-brand-grey">{hotel.brand}</span>
              </span>
              <span
                aria-hidden="true"
                className="text-brand-grey transition group-hover:translate-x-0.5 group-hover:text-brand"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
