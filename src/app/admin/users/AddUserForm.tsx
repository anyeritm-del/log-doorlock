"use client";

import { useActionState, useState } from "react";
import { addUserAction, type AddUserState } from "@/lib/actions/users";
import { Alert, buttonPrimary, inputClass, labelClass } from "@/components/ui";

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
      <label className={labelClass}>
        Email
        <input
          type="email"
          name="email"
          required
          placeholder="name@archipelagohotels.com"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Role
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "staff")}
          className={inputClass}
        >
          <option value="staff">Staff (per-hotel access)</option>
          <option value="admin">Admin (all hotels)</option>
        </select>
      </label>

      {role === "staff" && (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              name="accessAll"
              checked={accessAll}
              onChange={(e) => setAccessAll(e.target.checked)}
            />
            Access to all hotels
          </label>

          {!accessAll && (
            <fieldset className={labelClass}>
              <legend className="px-1 font-medium text-gray-700">Hotels</legend>
              {hotels.map((h) => (
                <label key={h.hotelId} className="flex items-center gap-2">
                  <input type="checkbox" name="hotelIds" value={h.hotelId} className="h-4 w-4 accent-brand" />
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
        className={buttonPrimary}
      >
        {pending ? "Adding…" : "Add user"}
      </button>
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
    </form>
  );
}
