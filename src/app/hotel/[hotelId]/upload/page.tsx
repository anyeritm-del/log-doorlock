import Link from "next/link";
import { requireHotelAccess } from "@/lib/authz";
import { listFloorNames } from "@/lib/rooms";
import { UploadForm } from "./UploadForm";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const hotel = await requireHotelAccess(hotelId);
  const floors = await listFloorNames(hotel.sheetId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        <Link href={`/hotel/${hotelId}`} className="hover:underline">
          {hotel.hotelName}
        </Link>{" "}
        / Upload
      </p>
      <h1 className="text-lg font-semibold">Upload a door lock log</h1>
      <p className="text-sm text-gray-600">
        Upload an Excel (.xlsx) or CSV export matching the standard 6-column layout (Date, Time,
        Card, Encoded by, Encoded Date, Encoded Time). Rows already present in the target floor
        won&apos;t be duplicated, and rows for room numbers not yet registered on that floor will
        be skipped — register them on the floor page first, then re-upload.
      </p>
      <UploadForm hotelId={hotelId} floors={floors} />
    </div>
  );
}
