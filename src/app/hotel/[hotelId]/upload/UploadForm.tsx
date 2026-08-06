"use client";

import { useActionState, useState } from "react";
import { uploadLogAction, type UploadState } from "@/lib/actions/upload";

const initialState: UploadState = { status: "idle" };

export function UploadForm({ hotelId, floors }: { hotelId: string; floors: string[] }) {
  const [state, formAction, pending] = useActionState(uploadLogAction, initialState);
  const [floorChoice, setFloorChoice] = useState(floors[0] ?? "__new__");

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="hotelId" value={hotelId} />

      <label className="flex flex-col gap-1 text-sm">
        Floor
        <select
          name="floorName"
          value={floorChoice}
          onChange={(e) => setFloorChoice(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5"
        >
          {floors.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          <option value="__new__">+ New floor…</option>
        </select>
      </label>

      {floorChoice === "__new__" && (
        <label className="flex flex-col gap-1 text-sm">
          New floor name
          <input
            name="newFloorName"
            required
            placeholder="e.g. Floor 4"
            className="rounded-md border border-gray-300 px-2 py-1.5"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        File
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,.xls,.csv"
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>

      {state.status === "success" && (
        <p className="text-sm text-green-700">
          {state.message} Added {state.added}, skipped {state.skipped} duplicate
          {state.skipped === 1 ? "" : "s"}.
        </p>
      )}
      {state.status === "error" && <p className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
