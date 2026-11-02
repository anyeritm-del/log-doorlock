"use client";

import { useActionState, useState } from "react";
import { uploadLogAction, type UploadState } from "@/lib/actions/upload";
import { Alert, buttonPrimary, inputClass, labelClass } from "@/components/ui";

const initialState: UploadState = { status: "idle" };

export function UploadForm({ hotelId, floors }: { hotelId: string; floors: string[] }) {
  const [state, formAction, pending] = useActionState(uploadLogAction, initialState);
  const [floorChoice, setFloorChoice] = useState(floors[0] ?? "__new__");
  // An Upkey PDF names its own room, so the floor is worked out on the server.
  const [isPdf, setIsPdf] = useState(false);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="hotelId" value={hotelId} />

      <label className={labelClass}>
        File
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={(e) => setIsPdf(/\.pdf$/i.test(e.target.files?.[0]?.name ?? ""))}
          className={inputClass}
        />
      </label>

      {isPdf ? (
        <p className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand">
          Upkey lock audit PDF: the room and floor are read from the file and created if needed.
        </p>
      ) : (
        <>
          <label className={labelClass}>
            Floor
            <select
              name="floorName"
              value={floorChoice}
              onChange={(e) => setFloorChoice(e.target.value)}
              className={inputClass}
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
            <label className={labelClass}>
              New floor name
              <input
                name="newFloorName"
                required
                placeholder="e.g. Floor 4"
                className={inputClass}
              />
            </label>
          )}
        </>
      )}

      {state.offerBackup && (
        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <input
            type="checkbox"
            name="moveUnreadableToBackup"
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            <span className="font-medium">Move old rows to a backup tab</span> — the app copies them
            to a new &quot;&lt;floor&gt; (backup &lt;date&gt;)&quot; tab in the Google Sheet, then clears
            them from the floor. Nothing is deleted.
          </span>
        </label>
      )}

      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Uploading…" : "Upload"}
      </button>

      {state.status === "success" && (
        <div className="flex flex-col gap-2">
          <Alert tone="success">
            {state.message} Added {state.added}, skipped {state.skipped} duplicate
            {state.skipped === 1 ? "" : "s"}.
          </Alert>
          {(state.skippedUnknown ?? 0) > 0 && (
            <Alert tone="warning">
              Skipped {state.skippedUnknown} row{state.skippedUnknown === 1 ? "" : "s"} for
              unregistered room{state.unknownRooms && state.unknownRooms.length === 1 ? "" : "s"}:{" "}
              {state.unknownRooms?.join(", ")}. Register them on the floor page and re-upload.
            </Alert>
          )}
        </div>
      )}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
    </form>
  );
}
