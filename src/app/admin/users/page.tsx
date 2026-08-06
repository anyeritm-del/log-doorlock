import { notFound } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/authz";
import { listUsers, listHotels } from "@/lib/registry";
import { AddUserForm } from "./AddUserForm";

export default async function AdminUsersPage() {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();

  const [users, hotels] = await Promise.all([listUsers(), listHotels()]);
  const hotelNameById = new Map(hotels.map((h) => [h.hotelId, h.hotelName]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Users</h1>

      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li
            key={u.email}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm"
          >
            <div>
              <div className="font-medium">{u.email}</div>
              <div className="text-gray-500">
                {u.role}
                {u.role === "staff" &&
                  " — " +
                    (u.hotelIds === "ALL"
                      ? "all hotels"
                      : u.hotelIds.map((id) => hotelNameById.get(id) ?? id).join(", ") ||
                        "no hotels assigned")}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="max-w-sm rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-600">Add a user</h2>
        <AddUserForm hotels={hotels.map((h) => ({ hotelId: h.hotelId, hotelName: h.hotelName }))} />
      </div>
    </div>
  );
}
