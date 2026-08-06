"use client";

import { useActionState, useState } from "react";
import { addUserAction, type AddUserState } from "@/lib/actions/users";

const initialState: AddUserState = { status: "idle" };

export function AddUserForm({
  hotels,
}: {
  hotels: Array<{ hotelId: string; hotelName: string }>;
}) {
  const [state, formAction, pending] = useActionState(addUserAction, initialState);
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [accessAll, setAccessAll] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          placeholder="name@archipelagohotels.com"
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Role
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "staff")}
          className="rounded-md border border-gray-300 px-2 py-1.5"
        >
          <option value="staff">Staff (per-hotel access)</option>
          <option value="admin">Admin (all hotels)</option>
        </select>
      </label>

      {role === "staff" && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="accessAll"
              checked={accessAll}
              onChange={(e) => setAccessAll(e.target.checked)}
            />
            Access to all hotels
          </label>

          {!accessAll && (
            <fieldset className="flex flex-col gap-1 text-sm">
              <legend className="mb-1 text-gray-600">Hotels</legend>
              {hotels.map((h) => (
                <label key={h.hotelId} className="flex items-center gap-2">
                  <input type="checkbox" name="hotelIds" value={h.hotelId} />
                  {h.hotelName}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add user"}
      </button>
      {state.status === "success" && <p className="text-sm text-green-700">{state.message}</p>}
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
