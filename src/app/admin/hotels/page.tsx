import { notFound } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/authz";
import { listHotels } from "@/lib/registry";
import { CreateHotelForm } from "./CreateHotelForm";

export default async function AdminHotelsPage() {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();

  const hotels = await listHotels();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Hotels</h1>

      <ul className="flex flex-col gap-2">
        {hotels.map((h) => (
          <li
            key={h.hotelId}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm"
          >
            <div>
              <div className="font-medium">{h.hotelName}</div>
              <div className="text-gray-500">{h.brand}</div>
            </div>
            <a
              href={`https://docs.google.com/spreadsheets/d/${h.sheetId}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open sheet
            </a>
          </li>
        ))}
      </ul>

      <div className="max-w-sm rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-600">Add a hotel</h2>
        <CreateHotelForm />
      </div>
    </div>
  );
}
