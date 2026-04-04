import { createClient } from "@/lib/supabase/server";
import type { CallFlow } from "@/types";
import CallFlowCard from "./call-flow-card";
import AddCallFlowButton from "./add-call-flow-button";

export default async function CallFlowPage() {
  const supabase = await createClient();

  const { data: flows } = await supabase
    .from("call_flows")
    .select("*")
    .order("created_at", { ascending: true });

  const callFlows = (flows ?? []) as CallFlow[];

  // Fetch extensions for use in step editors
  const { data: sipUsers } = await supabase
    .from("sip_users")
    .select("extension, display_name")
    .order("extension", { ascending: true });

  const extensions = (sipUsers ?? []) as { extension: string; display_name: string }[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Call Flow</h1>
          <p className="mt-1 text-neutral-400">
            Configure IVR menus, ring groups, and call forwarding
          </p>
        </div>
        <AddCallFlowButton />
      </div>

      {callFlows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-700 p-12 text-center">
          <p className="text-neutral-500">
            No call flows yet. Create one to define how incoming calls are
            handled.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {callFlows.map((flow) => (
            <CallFlowCard
              key={flow.id}
              flow={flow}
              extensions={extensions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
