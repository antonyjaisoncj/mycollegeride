// Shared server-side helpers for the bus management server functions.
// No secrets here — the caller passes an already-authenticated Supabase client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Client = SupabaseClient<Database>;

export async function assertAdmin(supabase: Client, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

export async function isAdmin(supabase: Client, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}
export async function isDriver(supabase: Client, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "driver")
    .maybeSingle();
  return Boolean(data);
}

/** Driver tab access: the bus driver or an admin. */
export async function assertDriverOrAdmin(
  supabase: Client,
  userId: string,
): Promise<{ admin: boolean }> {
  if (await isAdmin(supabase, userId)) return { admin: true };
  if (await isDriver(supabase, userId)) return { admin: false };
  throw new Error("Forbidden: driver access required");
}


/**
 * Read access for the shared tabs: admins always, approved students read-only.
 * Returns whether the caller is an admin so callers can widen or narrow data.
 */
export async function assertViewer(
  supabase: Client,
  userId: string,
): Promise<{ admin: boolean }> {
  if (await isAdmin(supabase, userId)) return { admin: true };
  const { data } = await supabase
    .from("students")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.status !== "approved") {
    throw new Error("Forbidden: your bus registration is not approved yet");
  }
  return { admin: false };
}

export type AppSettings = {
  expenses_visible: boolean;
  statement_visible: boolean;
  driver_visible: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  expenses_visible: true,
  statement_visible: true,
  driver_visible: true,
};

/** Reads the admin-controlled tab switches; defaults to everything visible. */
export async function readSettings(supabase: Client): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    expenses_visible: Boolean(data.expenses_visible),
    statement_visible: Boolean(data.statement_visible),
    driver_visible: Boolean(data.driver_visible),
  };
}
