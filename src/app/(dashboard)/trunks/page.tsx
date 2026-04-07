import { createClient } from "@/lib/supabase/server";
import type { Trunk, Did, SipUser } from "@/types";
import TrunkCard from "./trunk-card";
import AddTrunkButton from "./add-trunk-button";

export default async function TrunksPage() {
  const supabase = await createClient();

  const [{ data: trunks }, { data: dids }, { data: sipUsers }] =
    await Promise.all([
      supabase.from("trunks").select("*").order("created_at", { ascending: true }),
      supabase.from("dids").select("*").order("did_number", { ascending: true }),
      supabase
        .from("sip_users")
        .select("*")
        .eq("enabled", true)
        .order("extension", { ascending: true }),
    ]);

  const trunkList = (trunks ?? []) as Trunk[];
  const didList = (dids ?? []) as Did[];
  const extensions = (sipUsers ?? []) as SipUser[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SIP Trunks</h1>
          <p className="mt-1 text-neutral-400">
            Connect to your SIP provider for inbound/outbound calls
          </p>
        </div>
        <AddTrunkButton />
      </div>

      {trunkList.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-700 p-12 text-center">
          <p className="text-neutral-500">
            No trunks configured. Add your SIP provider to start making calls.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {trunkList.map((trunk) => (
            <TrunkCard
              key={trunk.id}
              trunk={trunk}
              dids={didList.filter((d) => d.trunk_id === trunk.id)}
              extensions={extensions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
