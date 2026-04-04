"use client";

import { useState } from "react";
import { createCallFlow } from "./actions";

export default function AddCallFlowButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError("");
    setLoading(true);
    const result = await createCallFlow(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setOpen(false);
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-xyra-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-xyra-500/25 transition hover:bg-xyra-600"
      >
        + New Call Flow
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-navy-900 p-6">
        <h2 className="text-lg font-bold">Create Call Flow</h2>
        <p className="mt-1 text-sm text-neutral-400">
          You can add routing steps after creating it.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-300">
              Flow Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Main Office Hours"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-neutral-300">
              Description <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="Handles incoming calls during business hours"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-xyra-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-xyra-600 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Flow"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(""); }}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
