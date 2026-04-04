"use client";

import { useState } from "react";
import type { Trunk } from "@/types";
import { toggleTrunk, deleteTrunk } from "./actions";
import TrunkForm from "./trunk-form";

export default function TrunkCard({ trunk }: { trunk: Trunk }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    await toggleTrunk(trunk.id, !trunk.enabled);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete trunk "${trunk.name}"?`)) return;
    setLoading(true);
    await deleteTrunk(trunk.id);
    setLoading(false);
  }

  return (
    <>
      <div className="rounded-xl border border-neutral-800 bg-navy-900 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{trunk.name}</h3>
            <p className="mt-1 font-mono text-sm text-neutral-400">
              {trunk.host}:{trunk.port}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              trunk.enabled
                ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                : "bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20"
            }`}
          >
            {trunk.enabled ? "Active" : "Disabled"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-neutral-500">Transport</p>
            <p className="mt-0.5 font-medium uppercase">{trunk.transport}</p>
          </div>
          <div>
            <p className="text-neutral-500">Auth</p>
            <p className="mt-0.5 font-medium">
              {trunk.username ? trunk.username : "No auth"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-xyra-500 hover:text-white"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <TrunkForm trunk={trunk} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
