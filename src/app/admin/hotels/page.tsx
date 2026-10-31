import { notFound } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/authz";
import { listHotels } from "@/lib/registry";
import { EmptyState, PageHeader, SectionTitle, cardClass } from "@/components/ui";
import { CreateHotelForm } from "./CreateHotelForm";

export default async function AdminHotelsPage() {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();

  const hotels = await listHotels();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Hotels" subtitle="All hotels registered in Door Lock Logs." />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="flex flex-col gap-4">
          <SectionTitle count={hotels.length}>Registered hotels</SectionTitle>
          {hotels.length === 0 ? (
            <EmptyState>No hotels yet.</EmptyState>
          ) : (
            <ul className={`${cardClass} divide-y divide-gray-100`}>
              {hotels.map((h) => (
                <li key={h.hotelId} className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-gray-900">{h.hotelName}</div>
                    <div className="text-brand-grey">{h.brand}</div>
                  </div>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${h.sheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-medium text-brand hover:underline"
                  >
                    Open sheet ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${cardClass} p-5`}>
          <h2 className="mb-4 font-bold text-brand">Add a hotel</h2>
          <CreateHotelForm />
        </section>
      </div>
    </div>
  );
}
