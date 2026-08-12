import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "service_unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error: countError } = await admin
    .from("admin_users")
    .select("user_id", { count: "exact", head: true });

  if (countError) return json({ error: "availability_check_failed" }, 500);
  const available = count === 0;

  if (request.method === "GET") return json({ available });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!available) return json({ error: "admin_already_configured" }, 409);

  let payload: { email?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "invalid_password" }, 400);

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return json({ error: "account_lookup_failed" }, 500);

  const existing = listed.users.find((user) => user.email?.toLowerCase() === email);
  let userId = existing?.id;
  let created = false;

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) return json({ error: "account_update_failed" }, 400);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return json({ error: "account_create_failed" }, 400);
    userId = data.user.id;
    created = true;
  }

  const { error: claimError } = await admin.rpc("claim_initial_admin", { candidate_user_id: userId });
  if (claimError) {
    if (created) await admin.auth.admin.deleteUser(userId);
    return json({ error: "admin_already_configured" }, 409);
  }

  return json({ success: true, email });
});

