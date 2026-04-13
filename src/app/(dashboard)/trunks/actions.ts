"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function parseTrunkForm(formData: FormData) {
  return {
    name: formData.get("name") as string,
    host: formData.get("host") as string,
    port: parseInt(formData.get("port") as string) || 5060,
    username: (formData.get("username") as string) || null,
    password: (formData.get("password") as string) || null,
    transport: (formData.get("transport") as string) || "udp",
    caller_id: (formData.get("caller_id") as string) || null,
  };
}

export async function createTrunk(formData: FormData) {
  const fields = parseTrunkForm(formData);

  if (!fields.name || !fields.host) {
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
    ...fields,
  });

  if (error) return { error: error.message };

  revalidatePath("/trunks");
  return { success: true };
}

export async function updateTrunk(id: string, formData: FormData) {
  const fields = parseTrunkForm(formData);

  if (!fields.name || !fields.host) {
    return { error: "Name and host are required" };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("trunks").update(fields).eq("id", id);

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

// ─── DIDs ───────────────────────────────────────────────────
// DIDs are inbound phone numbers (E.164) that the carrier routes to us.
// Each DID is owned by one trunk and maps to a destination — for MVP
// that's always an extension inside the same tenant.

function normalizeE164(raw: string): string {
  const trimmed = raw.replace(/\s+/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return "+" + trimmed.slice(2);
  return "+" + trimmed;
}

export async function createDid(trunkId: string, formData: FormData) {
  const rawNumber = (formData.get("did_number") as string) ?? "";
  const destinationType = (formData.get("destination_type") as string) || "extension";
  const destinationValue = (formData.get("destination_value") as string) ?? "";

  if (!rawNumber.trim() || !destinationValue.trim()) {
    return { error: "Number and destination are required" };
  }

  const didNumber = normalizeE164(rawNumber);

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

  const { error } = await supabase.from("dids").insert({
    tenant_id: profile.tenant_id,
    trunk_id: trunkId,
    did_number: didNumber,
    destination_type: destinationType,
    destination_value: destinationValue,
  });

  if (error) {
    // Unique-constraint violations on `did_number` bubble up as 23505.
    if (error.code === "23505") {
      return { error: `Number ${didNumber} is already assigned to another tenant` };
    }
    return { error: error.message };
  }

  revalidatePath("/trunks");
  return { success: true };
}

export async function toggleDid(id: string, enabled: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("dids")
    .update({ enabled })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/trunks");
  return { success: true };
}

export async function deleteDid(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("dids").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/trunks");
  return { success: true };
}
