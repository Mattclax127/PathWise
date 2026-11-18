export interface Opportunity {
  id: string; title: string; company_name: string; city: string; career_field: string; description: string;
  is_sample: boolean; source_label: string; j1_status: "confirmed_j1" | "previous_j1_participation" | "unverified"; j1_evidence_url: string | null;
}
export interface MatchProfile { destination_city: string; career_field: string }

/** Honest labels: previous participation is not current willingness; unverified is not J-1 compatible. */
export const J1_LABEL: Record<Opportunity["j1_status"], string> = {
  confirmed_j1: "J-1 interest confirmed (see source)",
  previous_j1_participation: "Hosted J-1 participants before (not proof of current interest)",
  unverified: "J-1 status unverified",
};

export function scoreOpportunity(o: Opportunity, p: MatchProfile): number {
  return (o.city === p.destination_city ? 2 : 0) + (o.career_field === p.career_field ? 1 : 0);
}

/** Best matches first; stable for ties; hides listings the applicant already saved or dismissed. */
export function rankOpportunities(list: Opportunity[], p: MatchProfile, hidden: ReadonlySet<string>): Opportunity[] {
  return list.filter((o) => !hidden.has(o.id)).map((o, i) => ({ o, i, s: scoreOpportunity(o, p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.o);
}
