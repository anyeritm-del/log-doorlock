"use client";

import { useActionState } from "react";
import { createFloorAction, type CreateFloorState } from "@/lib/actions/floors";

const initialState: CreateFloorState = { status: "idle" };

export function CreateFloorForm({ hotelId }: { hotelId: string }) {
  const [state, formAction, pending] = useActionState(createFloorAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="hotelId" value={hotelId} />
      <label className="flex flex-col gap-1 text-sm">
        New floor
        <input
          name="floorName"
          required
          placeholder="e.g. Floor 4"
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add floor"}
      </button>
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
