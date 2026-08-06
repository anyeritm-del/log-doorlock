import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHotelAccess } from "@/lib/authz";
import { listTabNames, readSheetRows } from "@/lib/googleSheets";
import { buildFloorIndex, type RawLogRow } from "@/lib/parseCard";

export default async function FloorPage({
  params,
}: {
  params: Promise<{ hotelId: string; floorId: string }>;
}) {
  const { hotelId, floorId } = await params;
  const floorName = decodeURIComponent(floorId);
  const hotel = await requireHotelAccess(hotelId);

  const tabs = await listTabNames(hotel.sheetId);
  if (!tabs.includes(floorName)) notFound();

  const rows = await readSheetRows(hotel.sheetId, floorName);
  const dataRows: RawLogRow[] = rows.slice(1).map((cells) => ({
    date: cells[0] ?? "",
    time: cells[1] ?? "",
    card: cells[2] ?? "",
    encodedBy: cells[3] ?? "",
    encodedDate: cells[4] ?? "",
    encodedTime: cells[5] ?? "",
  }));
  const index = buildFloorIndex(dataRows);

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
        {index.rooms.length === 0 && <p className="text-sm text-gray-600">No room activity yet.</p>}
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {index.rooms.map((room) => (
            <li key={room.room}>
              <Link
                href={`/hotel/${hotelId}/floor/${floorId}/room/${encodeURIComponent(room.room)}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 text-center hover:border-gray-400"
              >
                <div className="text-lg font-semibold">{room.room}</div>
                <div className="text-xs text-gray-500">{room.entries.length} entries</div>
              </Link>
            </li>
          ))}
        </ul>
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
