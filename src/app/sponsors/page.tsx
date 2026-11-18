import SponsorExplorer from "@/components/SponsorExplorer";
import { createClient } from "@/lib/supabase/server";
import { loadSponsorData } from "@/lib/sponsors/data";

export const metadata = { title: "Compare sponsors | PathWise" };

export default async function SponsorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { bundles, gov, error } = await loadSponsorData(supabase);

  let defaults = null;
  const saved: Record<string, "saved" | "shortlisted" | "preferred"> = {};
  let hasJourney = false;
  if (user) {
    const { data: q } = await supabase.from("questionnaire_responses").select("program_category,duration_months,career_field,country_of_residence,citizenship,education_status").maybeSingle();
    if (q) defaults = { category: q.program_category, months: q.duration_months, careerField: q.career_field, residence: q.country_of_residence, citizenship: q.citizenship, education: q.education_status };
    const { data: j } = await supabase.from("journeys").select("id").maybeSingle();
    hasJourney = !!j;
    const { data: opts } = await supabase.from("journey_sponsor_options").select("sponsor_id,status");
    for (const o of opts ?? []) saved[o.sponsor_id] = o.status;
  }
  return (
    <div className="wrap" style={{ padding: "28px 20px" }}>
      <h1>Compare J-1 sponsors</h1>
      <p className="muted">Only designated sponsors can issue the DS-2019. These are potential matches that the sponsor must confirm. Every fee shows its source and the date it was checked.</p>
      {error && <p className="err">Could not load sponsors: {error}</p>}
      <SponsorExplorer bundles={bundles} gov={gov} defaults={defaults} saved={saved} signedIn={!!user} hasJourney={hasJourney} />
    </div>
  );
}
