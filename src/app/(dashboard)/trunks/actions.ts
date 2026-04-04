"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTrunk(formData: FormData) {
  const name = formData.get("name") as string;
  const host = formData.get("host") as string;
  const port = parseInt(formData.get("port") as string) || 5060;
  const username = (formData.get("username") as string) || null;
  const password = (formData.get("password") as string) || null;
  const transport = (formData.get("transport") as string) || "udp";

  if (!name || !host) {
    return { error: "Name and host are required" };
  }

  const supabase = await createClient();

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

  const { error } = await supabase.from("trunks").insert({
    tenant_id: profile.tenant_id,
    name,
    host,
    port,
    username,
    password,
    transport,
  });

  if (error) return { error: error.message };

  revalidatePath("/trunks");
  return { success: true };
}

export async function updateTrunk(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const host = formData.get("host") as string;
  const port = parseInt(formData.get("port") as string) || 5060;
  const username = (formData.get("username") as string) || null;
  const password = (formData.get("password") as string) || null;
  const transport = (formData.get("transport") as string) || "udp";

  if (!name || !host) {
    return { error: "Name and host are required" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("trunks")
    .update({ name, host, port, username, password, transport })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/trunks");
  return { success: true };
}

export async function toggleTrunk(id: string, enabled: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("trunks")
    .update({ enabled })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/trunks");
  return { success: true };
}

export async function deleteTrunk(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("trunks").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/trunks");
  return { success: true };
}
