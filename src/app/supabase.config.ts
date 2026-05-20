import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://azwwuwwvvkqsvafqqkuq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XP3WvEsyfzdQLF_s2G_2jw_IPg3bXo0';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' },
});
