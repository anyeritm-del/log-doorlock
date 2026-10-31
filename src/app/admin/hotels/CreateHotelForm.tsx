"use client";

import { useActionState } from "react";
import { createHotelAction, type CreateHotelState } from "@/lib/actions/hotels";
import { Alert, buttonPrimary, inputClass, labelClass } from "@/components/ui";

const initialState: CreateHotelState = { status: "idle" };

export function CreateHotelForm() {
  const [state, formAction, pending] = useActionState(createHotelAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className={labelClass}>
        Hotel name
        <input
          name="hotelName"
          required
          placeholder="e.g. Aston Priority Simatupang"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Brand
        <input
          name="brand"
          required
          placeholder="e.g. Aston"
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={buttonPrimary}
      >
        {pending ? "Creating…" : "Create hotel"}
      </button>
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
    </form>
  );
}
