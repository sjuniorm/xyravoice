"use client";

import { useState } from "react";
import { createTrunk, updateTrunk } from "./actions";
import type { Trunk } from "@/types";

interface TrunkFormProps {
  trunk?: Trunk;
  onClose: () => void;
}

export default function TrunkForm({ trunk, onClose }: TrunkFormProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEdit = !!trunk;

  async function handleSubmit(formData: FormData) {
    setError("");
    setLoading(true);

    const result = isEdit
      ? await updateTrunk(trunk.id, formData)
      : await createTrunk(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-navy-900 p-6">
        <h2 className="text-lg font-bold">
          {isEdit ? "Edit Trunk" : "Add SIP Trunk"}
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Configure your SIP provider connection
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-300">
              Trunk Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={trunk?.name ?? ""}
              placeholder="Main Trunk"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="host" className="block text-sm font-medium text-neutral-300">
                Host
              </label>
              <input
                id="host"
                name="host"
                type="text"
                required
                defaultValue={trunk?.host ?? ""}
                placeholder="sip.provider.com"
                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
              />
            </div>
            <div>
              <label htmlFor="port" className="block text-sm font-medium text-neutral-300">
                Port
              </label>
              <input
                id="port"
                name="port"
                type="number"
                defaultValue={trunk?.port ?? 5060}
                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="transport" className="block text-sm font-medium text-neutral-300">
              Transport
            </label>
            <select
              id="transport"
              name="transport"
              defaultValue={trunk?.transport ?? "udp"}
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            >
              <option value="udp">UDP</option>
              <option value="tcp">TCP</option>
              <option value="tls">TLS</option>
            </select>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-neutral-300">
              Username <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              defaultValue={trunk?.username ?? ""}
              placeholder="trunk_user"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
              Password <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              defaultValue={trunk?.password ?? ""}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
          </div>

          <div>
            <label htmlFor="caller_id" className="block text-sm font-medium text-neutral-300">
              Outbound Caller ID <span className="text-neutral-500">(E.164)</span>
            </label>
            <input
              id="caller_id"
              name="caller_id"
              type="text"
              defaultValue={trunk?.caller_id ?? ""}
              placeholder="+34824805991"
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-navy-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-xyra-500 focus:outline-none focus:ring-1 focus:ring-xyra-500"
            />
            <p className="mt-1 text-xs text-neutral-500">
              The number shown to the people you call. Most providers require
              this to match a number on your account.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-xyra-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-xyra-600 disabled:opacity-50"
            >
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Add Trunk"}
            </button>
            <button
              type="button"
              onClick={onClose}
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
