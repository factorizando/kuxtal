import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Singleton — una sola instancia en toda la app
if (!globalThis.__supabase_instance) {
  globalThis.__supabase_instance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: "kuxtal-auth",
    },
  });
}

export const supabase = globalThis.__supabase_instance;
window.__supabase = supabase;
