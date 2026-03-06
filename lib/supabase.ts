import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) {
    return client;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    client = null;
    return client;
  }

  client = createClient(supabaseUrl, supabaseKey);
  return client;
}

export const supabase = getSupabaseClient();
