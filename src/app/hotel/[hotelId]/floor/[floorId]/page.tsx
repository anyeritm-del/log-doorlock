import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHotelAccess } from "@/lib/authz";
import { readSheetRows } from "@/lib/googleSheets";
import { listFloorNames, listRoomRoster, naturalRoomSort } from "@/lib/rooms";
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
  // Rooms with real log data show up even if nobody registered them via "Add rooms" — this
  // matters in practice since log data is often pasted directly into the sheet, bypassing the
  // app's upload flow (and its roster check) entirely.
  const allRooms = Array.from(new Set([...roster, ...index.rooms.map((r) => r.room)])).sort(
    naturalRoomSort
  );

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
        {allRooms.length === 0 && (
          <p className="text-sm text-gray-600">No rooms yet — add some below.</p>
        )}
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {allRooms.map((room) => (
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
