import { createClient } from "@supabase/supabase-js";

const serverClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
} as const;

export function createSupabasePublicServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase public server configuration is incomplete.");
  }

  return createClient(url, publishableKey, serverClientOptions);
}

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is incomplete.");
  }

  return createClient(url, serviceRoleKey, serverClientOptions);
}
