import { notFound } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/authz";
import { listUsers, listHotels } from "@/lib/registry";
import { EmptyState, PageHeader, SectionTitle, cardClass } from "@/components/ui";
import { AddUserForm } from "./AddUserForm";

export default async function AdminUsersPage() {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();

  const [users, hotels] = await Promise.all([listUsers(), listHotels()]);
  const hotelNameById = new Map(hotels.map((h) => [h.hotelId, h.hotelName]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Users" subtitle="Only users listed here can sign in." />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="flex flex-col gap-4">
          <SectionTitle count={users.length}>Registered users</SectionTitle>
          {users.length === 0 ? (
            <EmptyState>No users yet.</EmptyState>
          ) : (
            <ul className={`${cardClass} divide-y divide-gray-100`}>
              {users.map((u) => (
                <li key={u.email} className="flex items-center gap-4 px-5 py-4 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                    {u.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-gray-900">{u.email}</div>
                    {u.role === "staff" && (
                      <div className="truncate text-brand-grey">
                        {u.hotelIds === "ALL"
                          ? "All hotels"
                          : u.hotelIds.map((id) => hotelNameById.get(id) ?? id).join(", ") ||
                            "No hotels assigned"}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      u.role === "admin" ? "bg-brand text-white" : "bg-brand-soft text-brand"
                    }`}
                  >
                    {u.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${cardClass} p-5`}>
          <h2 className="mb-4 font-bold text-brand">Add a user</h2>
          <AddUserForm hotels={hotels.map((h) => ({ hotelId: h.hotelId, hotelName: h.hotelName }))} />
        </section>
      </div>
    </div>
  );
}
