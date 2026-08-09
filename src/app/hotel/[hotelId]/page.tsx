import Link from "next/link";
import { requireHotelAccess } from "@/lib/authz";
import { listFloorNames } from "@/lib/rooms";
import { CreateFloorForm } from "./CreateFloorForm";

export default async function HotelFloorsPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const hotel = await requireHotelAccess(hotelId);
  const floors = await listFloorNames(hotel.sheetId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{hotel.hotelName}</h1>
          <p className="text-sm text-gray-500">{hotel.brand}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/hotel/${hotelId}/report`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
          >
            Report
          </Link>
          <Link
            href={`/hotel/${hotelId}/upload`}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Upload log file
          </Link>
        </div>
      </div>

      <h2 className="text-sm font-medium text-gray-600">Floors</h2>
      {floors.length === 0 && <p className="text-sm text-gray-600">No floors yet.</p>}
      <ul className="grid gap-3 sm:grid-cols-3">
        {floors.map((floor) => (
          <li key={floor}>
            <Link
              href={`/hotel/${hotelId}/floor/${encodeURIComponent(floor)}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 text-center font-medium hover:border-gray-400"
            >
              {floor}
            </Link>
          </li>
        ))}
      </ul>

      <CreateFloorForm hotelId={hotelId} />
    </div>
  );
}
