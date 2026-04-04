"use server";

import { createClient } from "@/lib/supabase/server";
import { generateSipUsername, generateSipPassword } from "@/lib/sip";
import { revalidatePath } from "next/cache";

export async function createSipUser(formData: FormData) {
  const extension = formData.get("extension") as string;
  const displayName = formData.get("display_name") as string;
  const maxCalls = parseInt(formData.get("max_concurrent_calls") as string) || 2;

  if (!extension || !displayName) {
    return { error: "Extension and display name are required" };
  }

  const supabase = await createClient();

  // Get the user's tenant_id
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found" };

  const sipUsername = generateSipUsername(profile.tenant_id, extension);
  const sipPassword = generateSipPassword();

  const { error } = await supabase.from("sip_users").insert({
    tenant_id: profile.tenant_id,
    extension,
    display_name: displayName,
    sip_username: sipUsername,
    sip_password: sipPassword,
    max_concurrent_calls: maxCalls,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Extension ${extension} already exists` };
    }
    return { error: error.message };
  }

  revalidatePath("/extensions");
  return { success: true };
}

export async function toggleSipUser(id: string, enabled: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sip_users")
    .update({ enabled })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/extensions");
  return { success: true };
}

export async function deleteSipUser(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("sip_users").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/extensions");
  return { success: true };
}
