import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// CLIENT-SIDE (browser) — aman diimport di Client Component & hooks
// ---------------------------------------------------------------------------
// Menggunakan anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) yang memang dirancang
// untuk diekspos ke browser. Akses data dibatasi oleh Row Level Security (RLS)
// di Supabase. JANGAN gunakan service role key di sini.

let browserClient: SupabaseClient | undefined;

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { url, anonKey };
}

/** Singleton Supabase client untuk browser / Client Component. */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseEnv();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

// ---------------------------------------------------------------------------
// SERVER-SIDE (admin) — HANYA untuk API routes & Server Component
// ---------------------------------------------------------------------------
// Menggunakan service role key yang melewati RLS. Key ini bersifat rahasia
// dan TIDAK BOLEH pernah diimport di Client Component ("use client").
// Import createSupabaseAdminClient hanya dari file server (route.ts, page.tsx
// tanpa "use client", server actions, dll).

export function createSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "createSupabaseAdminClient() must not be called in the browser. " +
        "Use createSupabaseBrowserClient() for client-side code.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
