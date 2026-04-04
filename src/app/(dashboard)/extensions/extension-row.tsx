"use client";

import { useState } from "react";
import type { SipUser } from "@/types";
import { toggleSipUser, deleteSipUser } from "./actions";

export default function ExtensionRow({ extension }: { extension: SipUser }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    await toggleSipUser(extension.id, !extension.enabled);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete extension ${extension.extension} (${extension.display_name})?`)) {
      return;
    }
    setLoading(true);
    await deleteSipUser(extension.id);
    setLoading(false);
  }

  return (
    <tr className="hover:bg-navy-900/50">
      <td className="px-4 py-3 font-mono font-semibold text-xyra-400">
        {extension.extension}
      </td>
      <td className="px-4 py-3">{extension.display_name}</td>
      <td className="px-4 py-3 font-mono text-neutral-400">
        {extension.sip_username}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => setShowPassword(!showPassword)}
          className="font-mono text-neutral-400 hover:text-white"
        >
          {showPassword ? extension.sip_password : "••••••••"}
        </button>
      </td>
      <td className="px-4 py-3 text-neutral-400">
        {extension.max_concurrent_calls}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            extension.enabled
              ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
              : "bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20"
          }`}
        >
          {extension.enabled ? "Active" : "Disabled"}
        </button>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
