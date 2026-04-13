"use client";

import { useState } from "react";
import { Phone, Plus, Trash2 } from "lucide-react";
import type { Did, SipUser, CallFlow } from "@/types";
import { createDid, deleteDid, toggleDid } from "./actions";

interface DidsSectionProps {
  trunkId: string;
  dids: Did[];
  extensions: SipUser[];
  callFlows: Pick<CallFlow, "id" | "name" | "is_active">[];
}

export default function DidsSection({
  trunkId,
  dids,
  extensions,
  callFlows,
}: DidsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [destType, setDestType] = useState<"extension" | "callflow">("extension");

  async function handleAdd(formData: FormData) {
    setBusy("new");
    setError("");
    const result = await createDid(trunkId, formData);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAdding(false);
    setDestType("extension");
  }

  async function handleDelete(id: string, number: string) {
    if (!confirm(`Delete DID ${number}?`)) return;
    setBusy(id);
    await deleteDid(id);
    setBusy(null);
  }

  async function handleToggle(id: string, enabled: boolean) {
    setBusy(id);
    await toggleDid(id, !enabled);
    setBusy(null);
  }

  function destLabel(did: Did): string {
    if (did.destination_type === "callflow") {
      const flow = callFlows.find((f) => f.id === did.destination_value);
      return flow ? `call flow "${flow.name}"` : "call flow (unknown)";
    }
    const ext = extensions.find((e) => e.extension === did.destination_value);
    return `ext ${did.destination_value}${ext ? ` (${ext.display_name})` : ""}`;
  }

  return (
    <div className="mt-5 border-t border-neutral-800 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <Phone size={12} />
          Inbound Numbers
        </div>
        {!adding && (
          <button
            onClick={() => {
              setAdding(true);
              setError("");
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-xyra-400 transition hover:bg-xyra-500/10"
          >
            <Plus size={12} />
            Add DID
          </button>
        )}
      </div>

      {dids.length === 0 && !adding && (
        <p className="mt-2 text-xs text-neutral-500">
          No numbers yet. Add a DID to route inbound calls.
        </p>
      )}

      {dids.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {dids.map((did) => (
            <li
              key={did.id}
              className="flex items-center justify-between rounded-lg bg-navy-950 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-white">
                  {did.did_number}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  &rarr; {destLabel(did)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggle(did.id, did.enabled)}
                  disabled={busy === did.id}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                    did.enabled
                      ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                      : "bg-neutral-500/10 text-neutral-500 hover:bg-neutral-500/20"
                  }`}
                >
                  {did.enabled ? "On" : "Off"}
                </button>
                <button
                  onClick={() => handleDelete(did.id, did.did_number)}
                  disabled={busy === did.id}
                  className="rounded-lg p-1 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form
          action={handleAdd}
          className="mt-3 space-y-2 rounded-lg border border-neutral-800 bg-navy-950 p-3"
        >
          {error && (
            <div className="rounded bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              Phone Number (E.164)
            </label>
            <input
              name="did_number"
              type="text"
              required
              placeholder="+34824805991"
              className="mt-1 block w-full rounded border border-neutral-700 bg-navy-900 px-2 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-xyra-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              Route To
            </label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setDestType("extension")}
                className={`rounded px-2 py-1 text-[10px] font-semibold uppercase transition ${
                  destType === "extension"
                    ? "bg-xyra-500/20 text-xyra-400"
                    : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Extension
              </button>
              <button
                type="button"
                onClick={() => setDestType("callflow")}
                className={`rounded px-2 py-1 text-[10px] font-semibold uppercase transition ${
                  destType === "callflow"
                    ? "bg-xyra-500/20 text-xyra-400"
                    : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
                }`}
              >
                Call Flow
              </button>
            </div>
            <input type="hidden" name="destination_type" value={destType} />
          </div>
          <div>
            {destType === "extension" ? (
              <>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                  Extension
                </label>
                <select
                  name="destination_value"
                  required
                  defaultValue=""
                  className="mt-1 block w-full rounded border border-neutral-700 bg-navy-900 px-2 py-1.5 text-xs text-white focus:border-xyra-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select extension...
                  </option>
                  {extensions.map((ext) => (
                    <option key={ext.id} value={ext.extension}>
                      {ext.extension} — {ext.display_name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                  Call Flow
                </label>
                <select
                  name="destination_value"
                  required
                  defaultValue=""
                  className="mt-1 block w-full rounded border border-neutral-700 bg-navy-900 px-2 py-1.5 text-xs text-white focus:border-xyra-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select call flow...
                  </option>
                  {callFlows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name}
                    </option>
                  ))}
                </select>
                {callFlows.length === 0 && (
                  <p className="mt-1 text-[10px] text-neutral-600">
                    No active call flows. Create one on the Call Flow page first.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy === "new"}
              className="flex-1 rounded bg-xyra-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-xyra-600 disabled:opacity-50"
            >
              {busy === "new" ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError("");
                setDestType("extension");
              }}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:border-neutral-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
