import { createClient } from "@/lib/supabase/server";
import type { SipUser } from "@/types";
import CreateExtensionForm from "./create-form";
import ExtensionRow from "./extension-row";

export default async function ExtensionsPage() {
  const supabase = await createClient();

  const { data: sipUsers } = await supabase
    .from("sip_users")
    .select("*")
    .order("extension", { ascending: true });

  const extensions = (sipUsers ?? []) as SipUser[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Extensions</h1>
          <p className="mt-1 text-neutral-400">
            Manage SIP extensions for your team
          </p>
        </div>
        <CreateExtensionForm />
      </div>

      {/* Extensions table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-800 bg-navy-900">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-400">Ext</th>
              <th className="px-4 py-3 font-medium text-neutral-400">Name</th>
              <th className="px-4 py-3 font-medium text-neutral-400">SIP Username</th>
              <th className="px-4 py-3 font-medium text-neutral-400">SIP Password</th>
              <th className="px-4 py-3 font-medium text-neutral-400">Max Calls</th>
              <th className="px-4 py-3 font-medium text-neutral-400">Status</th>
              <th className="px-4 py-3 font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {extensions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  No extensions yet. Create your first one above.
                </td>
              </tr>
            ) : (
              extensions.map((ext) => (
                <ExtensionRow key={ext.id} extension={ext} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
