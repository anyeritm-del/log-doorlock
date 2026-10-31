"use client";

import { useActionState } from "react";
import { addRoomsAction, type AddRoomsState } from "@/lib/actions/rooms";
import { Alert, buttonPrimary, inputClass, labelClass } from "@/components/ui";

const initialState: AddRoomsState = { status: "idle" };

export function AddRoomsForm({ hotelId, floorName }: { hotelId: string; floorName: string }) {
  const [state, formAction, pending] = useActionState(addRoomsAction, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="floorName" value={floorName} />
      <label className={labelClass}>
        Room numbers (comma or newline separated)
        <textarea
          name="roomNumbers"
          required
          rows={3}
          placeholder={"301, 302, 303"}
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={`${buttonPrimary} self-start`}>
        {pending ? "Adding…" : "Add rooms"}
      </button>
      {state.status === "success" && (
        <Alert tone="success">
          {state.message}
          {state.alreadyExisted && state.alreadyExisted.length > 0
            ? ` (${state.alreadyExisted.length} already registered.)`
            : ""}
        </Alert>
      )}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
    </form>
  );
}
