import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHotelAccess } from "@/lib/authz";
import { readSheetRows } from "@/lib/googleSheets";
import { listFloorNames, listRoomRoster } from "@/lib/rooms";
import { buildFloorIndex, detectSheetFormat, rawLogRowFromCells } from "@/lib/parseCard";
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

  const [roster, rows] = await Promise.all([
    listRoomRoster(hotel.sheetId, floorName),
    readSheetRows(hotel.sheetId, floorName),
  ]);
  const format = detectSheetFormat(rows[0] ?? []);
  const dataRows = rows.slice(1).map((cells) => rawLogRowFromCells(cells, format));
  const index = buildFloorIndex(dataRows);
  const entryCountByRoom = new Map(index.rooms.map((r) => [r.room, r.entries.length]));
  const unregisteredLoggedRooms = index.rooms.filter((r) => !roster.includes(r.room));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-gray-500">
          <Link href={`/hotel/${hotelId}`} className="hover:underline">
            {hotel.hotelName}
          </Link>{" "}
          / {floorName}
        </p>
        <h1 className="text-lg font-semibold">{floorName}</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-600">Rooms</h2>
        {roster.length === 0 && (
          <p className="text-sm text-gray-600">No rooms registered yet — add some below.</p>
        )}
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {roster.map((room) => (
            <li key={room}>
              <Link
                href={`/hotel/${hotelId}/floor/${floorId}/room/${encodeURIComponent(room)}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 text-center hover:border-gray-400"
              >
                <div className="text-lg font-semibold">{room}</div>
                <div className="text-xs text-gray-500">
                  {entryCountByRoom.get(room) ?? 0} entries
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <AddRoomsForm hotelId={hotelId} floorName={floorName} />
      </section>

      {unregisteredLoggedRooms.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-600">
            Unregistered rooms found in log data
          </h2>
          <p className="text-xs text-gray-500">
            These appear in uploaded logs but aren&apos;t in this floor&apos;s room list above —
            register them to see them in the normal room list.
          </p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {unregisteredLoggedRooms.map((room) => (
              <li key={room.room}>
                <Link
                  href={`/hotel/${hotelId}/floor/${floorId}/room/${encodeURIComponent(room.room)}`}
                  className="block rounded-lg border border-amber-300 bg-amber-50 p-4 text-center hover:border-amber-500"
                >
                  <div className="text-lg font-semibold">{room.room}</div>
                  <div className="text-xs text-gray-500">{room.entries.length} entries</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {index.masterKeys.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-600">Master Keys</h2>
          <ul className="flex flex-col gap-2">
            {index.masterKeys.map((mk) => (
              <li
                key={mk.label}
                className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
              >
                <div className="font-medium">{mk.label}</div>
                <div className="text-xs text-gray-500">{mk.entries.length} entries</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
