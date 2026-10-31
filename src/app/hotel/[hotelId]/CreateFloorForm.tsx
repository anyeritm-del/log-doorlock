"use client";

import { useActionState } from "react";
import { createFloorAction, type CreateFloorState } from "@/lib/actions/floors";
import { Alert, buttonPrimary, inputClass, labelClass } from "@/components/ui";

const initialState: CreateFloorState = { status: "idle" };

export function CreateFloorForm({ hotelId }: { hotelId: string }) {
  const [state, formAction, pending] = useActionState(createFloorAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="hotelId" value={hotelId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className={labelClass}>
          New floor
          <input name="floorName" required placeholder="e.g. Floor 4" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Adding…" : "Add floor"}
        </button>
      </div>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
    </form>
  );
}
