import { createClient } from "@/lib/supabase/server";
import type { CallLog } from "@/types";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneCall,
  PhoneMissed,
  Clock,
} from "lucide-react";

function formatDuration(secs: number): string {
  if (secs === 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;

  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  return `${date} ${time}`;
}

const directionIcon = {
  inbound: PhoneIncoming,
  outbound: PhoneOutgoing,
  internal: PhoneCall,
};

const directionColor = {
  inbound: "text-blue-400",
  outbound: "text-emerald-400",
  internal: "text-xyra-400",
};

const statusBadge: Record<
  CallLog["status"],
  { label: string; className: string }
> = {
  answered: {
    label: "Answered",
    className: "bg-emerald-500/10 text-emerald-400",
  },
  missed: { label: "Missed", className: "bg-red-500/10 text-red-400" },
  busy: { label: "Busy", className: "bg-amber-500/10 text-amber-400" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-400" },
  no_answer: {
    label: "No Answer",
    className: "bg-neutral-500/10 text-neutral-400",
  },
};

export default async function CallHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const pageSize = 25;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("call_logs")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (params.direction && params.direction !== "all") {
    query = query.eq("direction", params.direction);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, count } = await query;
  const logs = (data ?? []) as CallLog[];
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (params.direction) p.set("direction", params.direction);
    if (params.status) p.set("status", params.status);
    if (params.page) p.set("page", params.page);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    return `/call-history${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Call History</h1>
          <p className="mt-1 text-neutral-400">
            {count ?? 0} total call{(count ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { value: "all", label: "All" },
          { value: "inbound", label: "Inbound" },
          { value: "outbound", label: "Outbound" },
          { value: "internal", label: "Internal" },
        ].map((opt) => (
          <a
            key={opt.value}
            href={buildUrl({
              direction: opt.value === "all" ? "" : opt.value,
              page: "1",
            })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              (params.direction ?? "all") === opt.value
                ? "bg-xyra-500/20 text-xyra-400"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            {opt.label}
          </a>
        ))}
        <span className="mx-1 self-center text-neutral-700">|</span>
        {[
          { value: "all", label: "Any status" },
          { value: "answered", label: "Answered" },
          { value: "missed", label: "Missed" },
          { value: "no_answer", label: "No Answer" },
        ].map((opt) => (
          <a
            key={opt.value}
            href={buildUrl({
              status: opt.value === "all" ? "" : opt.value,
              page: "1",
            })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              (params.status ?? "all") === opt.value
                ? "bg-xyra-500/20 text-xyra-400"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-700 p-12 text-center">
          <Clock size={32} className="mx-auto text-neutral-600" />
          <p className="mt-3 text-neutral-500">
            No call records yet. Calls will appear here once they start flowing.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-navy-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const DirIcon = directionIcon[log.direction];
                const badge = statusBadge[log.status];
                return (
                  <tr
                    key={log.id}
                    className="border-b border-neutral-800/50 transition hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DirIcon
                          size={14}
                          className={directionColor[log.direction]}
                        />
                        <span className="capitalize text-neutral-300">
                          {log.direction}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300">
                      {log.caller}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300">
                      {log.callee}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatDuration(log.duration_secs)}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {formatTime(log.started_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && (
            <a
              href={buildUrl({ page: String(page - 1) })}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-500 hover:text-white"
            >
              Previous
            </a>
          )}
          <span className="text-xs text-neutral-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={buildUrl({ page: String(page + 1) })}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-500 hover:text-white"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
