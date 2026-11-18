import type { SupabaseClient } from "@supabase/supabase-js";
import type { GovFee, SponsorBundle } from "./types";

/** Loads published, verified sponsor data. Row Level Security already hides everything else. */
export async function loadSponsorData(supabase: SupabaseClient): Promise<{ bundles: SponsorBundle[]; gov: GovFee[]; error?: string }> {
  const { data, error } = await supabase.from("sponsors").select(`
    id, slug, name, website_url, contact_phone, address, designation_source_url, designation_verified_at, is_sample, notes,
    sponsor_programs(*), sponsor_policies(*), sponsor_requirements(*), sponsor_sources(*),
    sponsor_fee_schedules(*, sponsor_fee_components(*), sponsor_fee_inclusions(*))`).order("name");
  const g = await supabase.from("government_fees").select("*");
  if (error || g.error) return { bundles: [], gov: [], error: (error ?? g.error)!.message };
  return { bundles: (data ?? []) as unknown as SponsorBundle[], gov: (g.data ?? []) as GovFee[] };
}
