import { createClient } from "@/lib/supabase/server";
import SettingsForms from "./settings-forms";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, tenants(name)")
    .eq("id", user!.id)
    .single();

  const companyName =
    profile?.tenants &&
    typeof profile.tenants === "object" &&
    "name" in profile.tenants
      ? (profile.tenants as { name: string }).name
      : "";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-neutral-400">
        Manage your profile and company settings
      </p>

      <div className="mt-8">
        <SettingsForms
          fullName={profile?.full_name || ""}
          email={profile?.email || user?.email || ""}
          role={profile?.role || "admin"}
          companyName={companyName}
        />
      </div>
    </div>
  );
}
