"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CallFlowStep } from "@/types";

async function getTenantId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  return profile?.tenant_id ?? null;
}

export async function createCallFlow(formData: FormData) {
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || "";

  if (!name) return { error: "Name is required" };

  const tenantId = await getTenantId();
  if (!tenantId) return { error: "Not authenticated" };

  const supabase = await createClient();

  const { error } = await supabase.from("call_flows").insert({
    tenant_id: tenantId,
    name,
    description,
    steps: [],
  });

  if (error) return { error: error.message };

  revalidatePath("/call-flow");
  return { success: true };
}

export async function updateCallFlowSteps(id: string, steps: CallFlowStep[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("call_flows")
    .update({ steps })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/call-flow");
  return { success: true };
}

export async function updateCallFlowInfo(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || "";

  if (!name) return { error: "Name is required" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("call_flows")
    .update({ name, description })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/call-flow");
  return { success: true };
}

export async function toggleCallFlow(id: string, isActive: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("call_flows")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/call-flow");
  return { success: true };
}

export async function deleteCallFlow(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("call_flows").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/call-flow");
  return { success: true };
}
