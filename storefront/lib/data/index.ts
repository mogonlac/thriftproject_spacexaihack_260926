import "server-only";
import { localRepo } from "./localRepo";
import type { Repo } from "./repo";
import { supabaseRepo } from "./supabaseRepo";

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Supabase when configured, otherwise the shared local JSON store in .data/. */
export const repo: Repo = hasSupabase ? supabaseRepo : localRepo;

export { normaliseReceiptId } from "./repo";
