import "server-only";
import { memoryRepo } from "./memoryRepo";
import type { Repo } from "./repo";
import { supabaseRepo } from "./supabaseRepo";

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Supabase when configured, otherwise the in-memory seed store. */
export const repo: Repo = hasSupabase ? supabaseRepo : memoryRepo;

export { normaliseReceiptId } from "./repo";
