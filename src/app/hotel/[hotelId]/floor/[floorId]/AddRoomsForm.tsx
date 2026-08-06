"use client";

import { useActionState } from "react";
import { addRoomsAction, type AddRoomsState } from "@/lib/actions/rooms";

const initialState: AddRoomsState = { status: "idle" };

export function AddRoomsForm({ hotelId, floorName }: { hotelId: string; floorName: string }) {
  const [state, formAction, pending] = useActionState(addRoomsAction, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-2">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="floorName" value={floorName} />
      <label className="flex flex-col gap-1 text-sm">
        Room numbers (comma or newline separated)
        <textarea
          name="roomNumbers"
          required
          rows={3}
          placeholder={"301, 302, 303"}
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add rooms"}
      </button>
      {state.status === "success" && (
        <p className="text-sm text-green-700">
          {state.message}
          {state.alreadyExisted && state.alreadyExisted.length > 0
            ? ` (${state.alreadyExisted.length} already registered.)`
            : ""}
        </p>
      )}
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
