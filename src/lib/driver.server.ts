import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Look up an auth account by email; returns null when nobody has signed up with it. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === needle);
    if (match) return match.id;
    if (users.length < 200) break;
  }
  return null;
}
