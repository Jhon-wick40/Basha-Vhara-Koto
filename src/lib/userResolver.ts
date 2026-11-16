import { supabase } from "@/integrations/supabase/client";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether an input string is a valid UUIDv4.
 */
export function isUuid(val: string | null | undefined): boolean {
  if (!val) return false;
  return UUID_REGEX.test(val.trim());
}

export interface ResolvedProfile {
  id: string; // Supabase UUID
  custom_uid?: string | null;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  business_name?: string | null;
  created_at?: string;
  updated_at?: string;
  kyc_status?: string | null;
}

/**
 * Resolves any user identifier (either Supabase UUID or Custom UID)
 * to their actual profile and primary UUID.
 */
export async function resolveUserProfile(identifier: string): Promise<ResolvedProfile | null> {
  const trimmed = identifier?.trim();
  if (!trimmed) return null;

  try {
    let query = supabase.from("profiles").select("*");
    if (isUuid(trimmed)) {
      query = query.eq("id", trimmed);
    } else {
      query = query.ilike("custom_uid", trimmed);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as ResolvedProfile;
  } catch (err) {
    console.warn("Failed to resolve user identifier:", err);
    return null;
  }
}
