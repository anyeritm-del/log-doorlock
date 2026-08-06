"use client";

import { useActionState } from "react";
import { createHotelAction, type CreateHotelState } from "@/lib/actions/hotels";

const initialState: CreateHotelState = { status: "idle" };

export function CreateHotelForm() {
  const [state, formAction, pending] = useActionState(createHotelAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Hotel name
        <input
          name="hotelName"
          required
          placeholder="e.g. Aston Priority Simatupang"
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Brand
        <input
          name="brand"
          required
          placeholder="e.g. Aston"
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create hotel"}
      </button>
      {state.status === "success" && <p className="text-sm text-green-700">{state.message}</p>}
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
