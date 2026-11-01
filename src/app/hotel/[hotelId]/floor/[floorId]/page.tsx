import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHotelAccess } from "@/lib/authz";
import { listFloorNames, listRoomRoster, naturalRoomSort } from "@/lib/rooms";
import { buildFloorIndex } from "@/lib/parseCard";
import { readFloorLogRows } from "@/lib/floorData";
import { EmptyState, PageHeader, SectionTitle, cardClass, linkCardClass } from "@/components/ui";
import { AddRoomsForm } from "./AddRoomsForm";

export default async function FloorPage({
  params,
}: {
  params: Promise<{ hotelId: string; floorId: string }>;
}) {
  const { hotelId, floorId } = await params;
  const floorName = decodeURIComponent(floorId);
  const hotel = await requireHotelAccess(hotelId);

  const floors = await listFloorNames(hotel.sheetId);
  if (!floors.includes(floorName)) notFound();

  const [roster, dataRows] = await Promise.all([
    listRoomRoster(hotel.sheetId, floorName),
    readFloorLogRows(hotel.sheetId, floorName),
  ]);
  const index = buildFloorIndex(dataRows);
  const entryCountByRoom = new Map(index.rooms.map((r) => [r.room, r.entries.length]));
  // Rooms with real log data show up even if nobody registered them via "Add rooms" — this
  // matters in practice since log data is often pasted directly into the sheet, bypassing the
  // app's upload flow (and its roster check) entirely.
  const allRooms = Array.from(new Set([...roster, ...index.rooms.map((r) => r.room)])).sort(
    naturalRoomSort
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={floorName}
        subtitle={`${allRooms.length} rooms · ${index.masterKeys.length} master keys`}
        breadcrumbs={[
          { label: "Hotels", href: "/" },
          { label: hotel.hotelName, href: `/hotel/${hotelId}` },
          { label: floorName },
        ]}
      />

      <section className="flex flex-col gap-4">
        <SectionTitle count={allRooms.length}>Rooms</SectionTitle>
        {allRooms.length === 0 && <EmptyState>No rooms yet. Add some below.</EmptyState>}
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {allRooms.map((room) => {
            const count = entryCountByRoom.get(room) ?? 0;
            return (
              <li key={room}>
                <Link
                  href={`/hotel/${hotelId}/floor/${floorId}/room/${encodeURIComponent(room)}`}
                  className={`${linkCardClass} p-4 text-center`}
                >
                  <div className="text-xl font-bold text-brand tabular-nums">{room}</div>
                  <div className={`mt-1 text-xs ${count > 0 ? "text-gray-600" : "text-brand-grey"}`}>
                    {count} {count === 1 ? "entry" : "entries"}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className={`${cardClass} p-5`}>
          <AddRoomsForm hotelId={hotelId} floorName={floorName} />
        </div>
      </section>

      {index.masterKeys.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle count={index.masterKeys.length}>Master keys</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {index.masterKeys.map((mk) => (
              <li key={mk.label} className={`${cardClass} flex items-center justify-between p-4 text-sm`}>
                <span className="font-bold text-gray-900">{mk.label}</span>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
                  {mk.entries.length} {mk.entries.length === 1 ? "entry" : "entries"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
