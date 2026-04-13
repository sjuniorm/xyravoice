import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Phone,
  Cable,
  GitBranch,
  PhoneIncoming,
  Building2,
  ArrowRight,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, tenants(name)")
    .eq("id", user!.id)
    .single();

  const tenantName =
    profile?.tenants &&
    typeof profile.tenants === "object" &&
    "name" in profile.tenants
      ? (profile.tenants as { name: string }).name
      : "Your Company";

  const { count: extensionCount } = await supabase
    .from("sip_users")
    .select("*", { count: "exact", head: true });

  const { count: trunkCount } = await supabase
    .from("trunks")
    .select("*", { count: "exact", head: true });

  const { count: flowCount } = await supabase
    .from("call_flows")
    .select("*", { count: "exact", head: true });

  const { count: didCount } = await supabase
    .from("dids")
    .select("*", { count: "exact", head: true });

  const stats = [
    {
      label: "Extensions",
      value: extensionCount ?? 0,
      icon: Phone,
      href: "/extensions",
      color: "text-xyra-400",
      bg: "bg-xyra-500/10",
    },
    {
      label: "Trunks",
      value: trunkCount ?? 0,
      icon: Cable,
      href: "/trunks",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "DIDs",
      value: didCount ?? 0,
      icon: PhoneIncoming,
      href: "/trunks",
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Call Flows",
      value: flowCount ?? 0,
      icon: GitBranch,
      href: "/call-flow",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  const quickActions = [
    { label: "Add Extension", href: "/extensions", icon: Phone },
    { label: "Add Trunk", href: "/trunks", icon: Cable },
    { label: "Create Call Flow", href: "/call-flow", icon: GitBranch },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Welcome */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-xyra-500/10">
          <Building2 size={22} className="text-xyra-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {profile?.full_name || user?.email}
          </h1>
          <p className="text-sm text-neutral-400">{tenantName}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group rounded-xl border border-neutral-800 bg-navy-900 p-5 transition hover:border-neutral-700"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <Icon size={18} className={stat.color} />
                </div>
                <ArrowRight
                  size={16}
                  className="text-neutral-700 transition group-hover:text-neutral-400"
                />
              </div>
              <p className="mt-4 text-2xl font-bold">
                {stat.value}
              </p>
              <p className="mt-0.5 text-sm text-neutral-400">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Quick Actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-navy-900 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-xyra-500 hover:text-white"
              >
                <Icon size={16} />
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* System status */}
      <div className="mt-8 rounded-xl border border-neutral-800 bg-navy-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          System Overview
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm text-neutral-300">Supabase Connected</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${(trunkCount ?? 0) > 0 ? "bg-emerald-400" : "bg-neutral-600"}`} />
            <span className={`text-sm ${(trunkCount ?? 0) > 0 ? "text-neutral-300" : "text-neutral-400"}`}>
              SIP Server — {(trunkCount ?? 0) > 0 ? `${trunkCount} trunk${trunkCount !== 1 ? "s" : ""} active` : "No trunks configured"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${(extensionCount ?? 0) > 0 ? "bg-emerald-400" : "bg-neutral-600"}`} />
            <span className={`text-sm ${(extensionCount ?? 0) > 0 ? "text-neutral-300" : "text-neutral-400"}`}>
              WebRTC — {(extensionCount ?? 0) > 0 ? `${extensionCount} extension${extensionCount !== 1 ? "s" : ""} ready` : "No extensions"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
