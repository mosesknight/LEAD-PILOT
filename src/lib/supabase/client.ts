"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured || !url || !anonKey) return null;
  if (!cachedClient) {
    cachedClient = createBrowserClient(url, anonKey);
  }
  return cachedClient;
}
