import type { Category, Component, GovFee, Schedule, SponsorBundle } from "./types";

/** Rules-based, integer-cents cost engine. Pure and database-free so it is easy to test.
 *  - Never double-counts: if a sponsor package includes a cost, or itemizes its own pass-through charge, the
 *    government fee is not added on top.
 *  - Unknown amounts are reported as unknown, never as zero.
 *  - An incomplete estimate has no total. Its known costs are a floor ("at least"), because unknown costs cannot be negative. */
export type CostKey = "sponsor_fee" | "processing" | "other_mandatory" | "sevis_fee" | "visa_fee" | "insurance";
export type LineStatus = "known" | "included" | "unknown";
export interface CostLine { key: CostKey; label: string; status: LineStatus; amountCents: number | null; note?: string }
export interface CostInput { category: Category; months: number; residence: string | null; education?: string | null }
export interface CostResult {
  sponsorId: string;
  scheduleLabel: string | null;
  verifiedAt: string | null;
  sourceUrl: string | null;
  lines: CostLine[];
  knownTotalCents: number;       // sum of known lines, including government fees added without sponsor confirmation
  floorCents: number;            // known lines that are confirmed. Unknown costs cannot be negative, so this is a true "at least"
  unknownKeys: CostKey[];
  unconfirmed: CostKey[];        // government fee added because the sponsor does not say whether it is included
  complete: boolean;
  totalCents: number | null;     // only when complete
  includedServices: string[];
  optional: { label: string; amountCents: number | null; notes: string | null }[];
  notes: string[];
}

const norm = (s: string) => s.trim().toLowerCase();
const inRange = (c: Component, m: number) => (c.duration_min_months ?? 0) <= m && m <= (c.duration_max_months ?? Number.POSITIVE_INFINITY);

export function pickSchedule(schedules: Schedule[], category: Category, residence: string | null, education: string | null = null): Schedule | null {
  const cat = schedules.filter((s) => s.category === category && s.currency === "USD");
  const fits = cat.filter((s) =>
    (!s.applies_to_residence || (!!residence && s.applies_to_residence.some((r) => norm(r) === norm(residence)))) &&
    (!s.applies_to_education || (!!education && s.applies_to_education.includes(education))));
  const specificity = (s: Schedule) => (s.applies_to_residence ? 1 : 0) + (s.applies_to_education ? 1 : 0);
  return fits.sort((a, b) => specificity(b) - specificity(a))[0] ?? null;
}

const amountOf = (c: Component, months: number) => (c.amount_cents === null ? null : c.per === "per_month" ? c.amount_cents * months : c.amount_cents);

/** Collapses alternatives (same choice_group) to the cheapest known option, then sums. Returns null if anything needed is unknown. */
function sumComponents(list: Component[], months: number, notes: string[]): number | null {
  const groups = new Map<string, Component[]>();
  const singles: Component[] = [];
  for (const c of list) (c.choice_group ? groups.set(c.choice_group, [...(groups.get(c.choice_group) ?? []), c]) : singles.push(c));
  let total = 0;
  for (const c of singles) { const a = amountOf(c, months); if (a === null) return null; total += a; }
  for (const opts of groups.values()) {
    const priced = opts.map((c) => ({ c, a: amountOf(c, months) })).filter((x): x is { c: Component; a: number } => x.a !== null).sort((x, y) => x.a - y.a);
    if (!priced.length) return null;
    total += priced[0].a;
    if (opts.length > 1) notes.push(`Uses the lowest-priced option (${priced[0].c.label}). Other options cost more: ${priced.slice(1).map((x) => x.c.label).join(", ")}.`);
  }
  return total;
}

export function estimate(bundle: SponsorBundle, gov: GovFee[], input: CostInput): CostResult {
  const { category, months, residence } = input;
  const education = input.education ?? null;
  const schedule = pickSchedule(bundle.sponsor_fee_schedules, category, residence, education);
  const source = schedule ? bundle.sponsor_sources.find((s) => s.id === schedule.source_id) : undefined;
  const lines: CostLine[] = [];
  const notes: string[] = [];
  const comps = (schedule?.sponsor_fee_components ?? []).filter((c) => inRange(c, months));
  const included = new Set((schedule?.sponsor_fee_inclusions ?? []).map((i) => i.service_key));
  const govFee = (key: string) => gov.find((g) => g.key === key && g.included_in_comparison && g.applies_to_categories.includes(category));
  const unconfirmed: CostKey[] = [];

  if (!schedule) {
    const hasCategorySchedules = bundle.sponsor_fee_schedules.some((s) => s.category === category);
    notes.push(hasCategorySchedules ? "This sponsor prices by student status or country. Add yours to see its fee." : "No verified fee schedule for this category.");
  }
  if (schedule?.applies_to_residence === null && residence === null && bundle.sponsor_fee_schedules.some((s) => s.applies_to_residence)) notes.push("Your country of residence is unknown, so the standard schedule was used.");

  const programFee = comps.filter((c) => c.component_type === "sponsor_program_fee");
  const programTotal = programFee.length ? sumComponents(programFee, months, notes) : null;
  lines.push(programTotal === null
    ? { key: "sponsor_fee", label: "Sponsor program fee", status: "unknown", amountCents: null, note: schedule ? "No published fee for this duration." : "Not confirmed." }
    : { key: "sponsor_fee", label: "Sponsor program fee", status: "known", amountCents: programTotal });

  for (const [type, key, label] of [["processing", "processing", "Processing and review charges"], ["other_mandatory", "other_mandatory", "Other mandatory charges"]] as const) {
    const list = comps.filter((c) => c.component_type === type && c.is_mandatory);
    if (!list.length) continue;
    const total = sumComponents(list, months, notes);
    lines.push(total === null ? { key, label, status: "unknown", amountCents: null } : { key, label, status: "known", amountCents: total });
  }

  for (const [type, key, label, govKey] of [["sevis_fee", "sevis_fee", "SEVIS fee", "sevis_i901_j"], ["visa_fee", "visa_fee", "Visa application fee", "visa_mrv_nonimmigrant"]] as const) {
    const own = comps.filter((c) => c.component_type === type && c.is_mandatory);
    if (included.has(key)) { lines.push({ key, label, status: "included", amountCents: 0, note: "Included in the sponsor package, not added again." }); continue; }
    if (own.length) { const t = sumComponents(own, months, notes); lines.push(t === null ? { key, label, status: "unknown", amountCents: null } : { key, label, status: "known", amountCents: t, note: "Collected by the sponsor, so the government fee is not added again." }); continue; }
    const g = govFee(govKey);
    if (g && g.amount_cents !== null) {
      const confirmed = !!schedule?.inclusions_confirmed;
      lines.push({ key, label, status: "known", amountCents: g.amount_cents, note: confirmed ? "Paid separately to the government." : "Added from the government schedule; the sponsor does not say whether it is included." });
      if (!confirmed) unconfirmed.push(key);
    } else lines.push({ key, label, status: "unknown", amountCents: null });
  }

  const insComps = comps.filter((c) => c.component_type === "insurance" && c.is_mandatory);
  if (included.has("insurance")) lines.push({ key: "insurance", label: "Insurance", status: "included", amountCents: 0, note: "Included in the sponsor package, not added again." });
  else if (insComps.length) { const t = sumComponents(insComps, months, notes); lines.push(t === null ? { key: "insurance", label: "Insurance", status: "unknown", amountCents: null } : { key: "insurance", label: "Insurance", status: "known", amountCents: t }); }
  else lines.push({ key: "insurance", label: "Insurance", status: "unknown", amountCents: null, note: "The sponsor has not published insurance costs." });

  const unknownKeys = lines.filter((l) => l.status === "unknown").map((l) => l.key);
  const knownTotalCents = lines.reduce((sum, l) => sum + (l.status === "known" ? (l.amountCents ?? 0) : 0), 0);
  if (schedule && !schedule.is_itemized_complete) notes.push("The sponsor's published fee list may not include every charge that could apply to you.");
  const floorCents = lines.reduce((sum, l) => sum + (l.status === "known" && !unconfirmed.includes(l.key) ? (l.amountCents ?? 0) : 0), 0);
  const complete = !!schedule && unknownKeys.length === 0 && unconfirmed.length === 0 && schedule.is_itemized_complete;

  return {
    sponsorId: bundle.id, scheduleLabel: schedule?.label ?? null, verifiedAt: schedule?.verified_at ?? null, sourceUrl: source?.url ?? null,
    lines, knownTotalCents, floorCents, unknownKeys, unconfirmed, complete, totalCents: complete ? knownTotalCents : null,
    includedServices: [...included], notes: [...new Set([...notes, ...(schedule?.notes ? [schedule.notes] : [])])],
    optional: comps.filter((c) => !c.is_mandatory || c.component_type === "optional_service").map((c) => ({ label: c.label, amountCents: amountOf(c, months), notes: c.notes })),
  };
}

/** Complete estimates are ranked by total. Incomplete ones are never ranked or called cheapest; they are listed after,
 *  ordered by their known floor so applicants can still compare what is known. */
export function rankByCost(results: CostResult[]) {
  const ranked = results.filter((r) => r.complete).sort((a, b) => (a.totalCents as number) - (b.totalCents as number)).map((r, i) => ({ ...r, rank: i + 1 }));
  // A sponsor with nothing confirmed (floor 0) goes last so it never looks like the cheapest.
  const key = (r: CostResult) => (r.floorCents === 0 ? Number.POSITIVE_INFINITY : r.floorCents);
  const incomplete = results.filter((r) => !r.complete).sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1));
  return { ranked, incomplete, lowestCompleteId: ranked[0]?.sponsorId ?? null };
}
