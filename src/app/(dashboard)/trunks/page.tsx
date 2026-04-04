import { createClient } from "@/lib/supabase/server";
import type { Trunk } from "@/types";
import TrunkCard from "./trunk-card";
import AddTrunkButton from "./add-trunk-button";

export default async function TrunksPage() {
  const supabase = await createClient();

  const { data: trunks } = await supabase
    .from("trunks")
    .select("*")
    .order("created_at", { ascending: true });

  const trunkList = (trunks ?? []) as Trunk[];

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
            <TrunkCard key={trunk.id} trunk={trunk} />
          ))}
        </div>
      )}
    </div>
  );
}
