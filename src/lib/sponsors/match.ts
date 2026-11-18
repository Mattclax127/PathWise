import type { Category, Program, SelfPlacement, SponsorBundle } from "./types";

/** Heuristic mapping from PathWise career fields to State Department occupational fields. It only supports
 *  "possible field match" labels. It never decides eligibility; the sponsor confirms fit. */
export const FIELD_MAP: Record<string, string[]> = {
  marketing: ["Information Media and Communications", "Management, Business, Commerce and Finance"],
  hospitality: ["Hospitality and Tourism"],
  technology: ["The Sciences, Engineering, Architecture, Mathematics, and Industrial Occupations", "Information Media and Communications"],
  business: ["Management, Business, Commerce and Finance"],
  design: ["Arts and Culture", "Information Media and Communications"],
  other: [],
};

export interface MatchInput { category: Category; months: number; careerField: string; citizenship?: string | null }
export interface MatchResult {
  sponsorId: string; programId: string | null; categoryOffered: boolean;
  duration: "fits" | "outside" | "unknown"; field: "listed" | "not_listed" | "unknown";
  selfPlacement: SelfPlacement; nationality: "restricted" | "none_known";
  potentialMatch: boolean; reasons: string[];
}
const norm = (s: string) => s.trim().toLowerCase();

export function matchSponsor(b: SponsorBundle, input: MatchInput): MatchResult {
  const program: Program | undefined = b.sponsor_programs.find((p) => p.category === input.category);
  const reasons: string[] = [];
  const policy = b.sponsor_policies.find((p) => p.policy_key === "self_placement");
  const selfPlacement: SelfPlacement = policy?.value ?? "unknown";
  let duration: MatchResult["duration"] = "unknown";
  if (program && (program.max_duration_months !== null || program.min_duration_months !== null)) {
    const okMax = program.max_duration_months === null || input.months <= program.max_duration_months;
    const okMin = program.min_duration_months === null || input.months >= program.min_duration_months;
    duration = okMax && okMin ? "fits" : "outside";
  }
  let field: MatchResult["field"] = "unknown";
  if (program && program.fields.length) {
    const wanted = FIELD_MAP[input.careerField] ?? [];
    field = wanted.length === 0 ? "unknown" : program.fields.some((f) => wanted.includes(f)) ? "listed" : "not_listed";
  }
  let nationality: MatchResult["nationality"] = "none_known";
  if (input.citizenship) {
    for (const r of b.sponsor_requirements.filter((x) => x.requirement_type === "nationality_restriction" && x.countries?.length && (!x.category || x.category === input.category))) {
      const listed = r.countries!.some((c) => norm(c) === norm(input.citizenship!));
      if ((r.country_mode === "only" && !listed) || (r.country_mode === "excluded" && listed)) nationality = "restricted";
    }
  }
  if (!program) reasons.push(`No verified ${input.category} program listed.`);
  if (duration === "outside") reasons.push("Your program length is outside the published range.");
  if (field === "not_listed") reasons.push("Your field is not among the sponsor's listed fields.");
  if (selfPlacement === "not_accepted") reasons.push("Does not accept self-arranged placements.");
  if (nationality === "restricted") reasons.push("A published nationality restriction may apply.");
  const potentialMatch = !!program && duration !== "outside" && field !== "not_listed" && selfPlacement !== "not_accepted" && nationality !== "restricted";
  return { sponsorId: b.id, programId: program?.id ?? null, categoryOffered: !!program, duration, field, selfPlacement, nationality, potentialMatch, reasons };
}

export const SELF_PLACEMENT_LABEL: Record<SelfPlacement, string> = {
  accepted: "Accepts self-arranged placements", required: "Self-arranged placement required (no placement offered)",
  conditional: "Accepts self-arranged placements with conditions", not_accepted: "Does not accept self-arranged placements", unknown: "Not confirmed",
};

export interface Filters { search: string; category: Category; selfPlacement: "any" | SelfPlacement; potentialOnly: boolean }
export function filterSponsors(bundles: SponsorBundle[], f: Filters, input: MatchInput) {
  const q = f.search.trim().toLowerCase();
  return bundles.map((b) => ({ bundle: b, match: matchSponsor(b, { ...input, category: f.category }) }))
    .filter(({ bundle, match }) => (!q || bundle.name.toLowerCase().includes(q)) && match.categoryOffered
      && (f.selfPlacement === "any" || match.selfPlacement === f.selfPlacement) && (!f.potentialOnly || match.potentialMatch));
}
