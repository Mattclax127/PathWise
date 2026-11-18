import { describe, expect, it } from "vitest";
import { estimate, pickSchedule, rankByCost } from "@/lib/sponsors/compare";
import { matchSponsor } from "@/lib/sponsors/match";
import type { Component, GovFee, SponsorBundle } from "@/lib/sponsors/types";

const gov: GovFee[] = [
  { key: "sevis_i901_j", label: "SEVIS", amount_cents: 22000, applies_to_categories: ["intern", "trainee"], included_in_comparison: true, source_url: "x", verified_at: "2026-11-13", note: null },
  { key: "visa_mrv_nonimmigrant", label: "MRV", amount_cents: 18500, applies_to_categories: ["intern", "trainee"], included_in_comparison: true, source_url: "x", verified_at: "2026-11-13", note: null },
];
const comp = (m: number, cents: number | null, type: Component["component_type"] = "sponsor_program_fee", extra: Partial<Component> = {}): Component =>
  ({ id: `c${m}${type}`, component_type: type, label: type, amount_cents: cents, per: "one_time", is_mandatory: true, choice_group: null, duration_min_months: m, duration_max_months: m, notes: null, ...extra });
const bundle = (id: string, o: { included?: string[]; comps?: Component[]; schedule?: boolean; complete?: boolean; confirmed?: boolean; extra?: Partial<SponsorBundle> } = {}): SponsorBundle => ({
  id, slug: id, name: id, website_url: null, contact_phone: null, address: null, designation_source_url: null, designation_verified_at: null, is_sample: false, notes: null,
  sponsor_programs: [{ id: `p${id}`, category: "intern", designation_evidence: "state_directory", fields: [], min_duration_months: null, max_duration_months: 12, verified_at: null, notes: null }],
  sponsor_policies: [], sponsor_requirements: [],
  sponsor_sources: [{ id: "src", url: "https://s", info_type: "fees", verified_at: "2026-11-13", review_status: "verified", note: null }],
  sponsor_fee_schedules: o.schedule === false ? [] : [{ id: `s${id}`, category: "intern", label: "L", applies_to_residence: null, applies_to_education: null, currency: "USD", is_itemized_complete: o.complete ?? true,
    inclusions_confirmed: o.confirmed ?? true, notes: null, verified_at: "2026-11-13", source_id: "src", sponsor_fee_components: o.comps ?? [comp(6, 175000)],
    sponsor_fee_inclusions: (o.included ?? []).map((k) => ({ service_key: k, detail: null })) }],
  ...o.extra,
});
const run = (b: SponsorBundle, months = 6, residence: string | null = null) => estimate(b, gov, { category: "intern", months, residence });

describe("no double counting", () => {
  it("does not add SEVIS or insurance again when the package includes them", () => {
    const r = run(bundle("A", { included: ["sevis_fee", "insurance"] }));
    expect(r.lines.find((l) => l.key === "sevis_fee")).toMatchObject({ status: "included", amountCents: 0 });
    expect(r.lines.find((l) => l.key === "insurance")).toMatchObject({ status: "included", amountCents: 0 });
    expect(r.totalCents).toBe(175000 + 18500); // sponsor fee + visa fee only
  });
  it("adds government fees when nothing is included", () => {
    const r = run(bundle("B", { comps: [comp(6, 175000), comp(6, 9000, "insurance")] }));
    expect(r.totalCents).toBe(175000 + 22000 + 18500 + 9000);
  });
  it("uses the sponsor's own pass-through SEVIS charge instead of adding the government amount", () => {
    const r = run(bundle("C", { comps: [comp(6, 175000), comp(6, 22000, "sevis_fee")], included: ["insurance"] }));
    expect(r.lines.filter((l) => l.key === "sevis_fee")).toHaveLength(1);
    expect(r.totalCents).toBe(175000 + 22000 + 18500);
  });
  it("multiplies per-month components by months", () => {
    const r = run(bundle("D", { comps: [comp(6, 175000), comp(6, 3000, "insurance", { per: "per_month" })] }));
    expect(r.lines.find((l) => l.key === "insurance")?.amountCents).toBe(18000);
  });
  it("never counts optional services in the total", () => {
    const r = run(bundle("E", { included: ["sevis_fee", "insurance"], comps: [comp(6, 175000), comp(6, 5000, "optional_service", { is_mandatory: false })] }));
    expect(r.totalCents).toBe(175000 + 18500);
    expect(r.optional).toHaveLength(1);
  });
});

describe("unknown costs", () => {
  it("reports unknown as unknown, never zero, and marks the estimate incomplete", () => {
    const r = run(bundle("F", { schedule: false }));
    expect(r.complete).toBe(false);
    expect(r.totalCents).toBeNull();
    expect(r.unknownKeys).toContain("sponsor_fee");
    expect(r.lines.find((l) => l.key === "sponsor_fee")?.amountCents).toBeNull();
  });
  it("is incomplete when the duration has no published price", () => {
    const r = run(bundle("G", { comps: [comp(3, 100000)], included: ["sevis_fee", "insurance"] }), 6);
    expect(r.lines[0].status).toBe("unknown");
    expect(r.complete).toBe(false);
  });
  it("is incomplete when the sponsor does not say what is included", () => {
    const r = run(bundle("H", { confirmed: false, comps: [comp(6, 175000), comp(6, 9000, "insurance")] }));
    expect(r.unconfirmed).toEqual(expect.arrayContaining(["sevis_fee", "visa_fee"]));
    expect(r.complete).toBe(false);
  });
  it("is incomplete when the sponsor's fee list may omit charges", () => {
    expect(run(bundle("I", { complete: false, included: ["sevis_fee", "insurance"] })).complete).toBe(false);
  });
});

describe("ranking", () => {
  it("ranks only complete estimates and never calls an incomplete one cheapest", () => {
    const cheapIncomplete = run(bundle("cheap", { complete: false, comps: [comp(6, 10000)], included: ["sevis_fee", "insurance"] }));
    const a = run(bundle("A", { included: ["sevis_fee", "insurance"] }));
    const b = run(bundle("B", { included: ["sevis_fee", "insurance"], comps: [comp(6, 150000)] }));
    const r = rankByCost([cheapIncomplete, a, b]);
    expect(r.ranked.map((x) => x.sponsorId)).toEqual(["B", "A"]);
    expect(r.incomplete.map((x) => x.sponsorId)).toEqual(["cheap"]);
    expect(r.lowestCompleteId).toBe("B");
  });
  it("has no cheapest when everything is incomplete", () => {
    expect(rankByCost([run(bundle("X", { schedule: false }))]).lowestCompleteId).toBeNull();
  });
});

describe("residence-based schedules", () => {
  it("picks the country schedule, case-insensitively, else the default", () => {
    const b = bundle("R");
    b.sponsor_fee_schedules.push({ ...b.sponsor_fee_schedules[0], id: "fr", applies_to_residence: ["France"], sponsor_fee_components: [comp(6, 165000)] });
    expect(pickSchedule(b.sponsor_fee_schedules, "intern", "france")?.id).toBe("fr");
    expect(pickSchedule(b.sponsor_fee_schedules, "intern", "Spain")?.id).toBe("sR");
    expect(run(b, 6, "France").lines[0].amountCents).toBe(165000);
  });
});

describe("matching", () => {
  const input = { category: "intern" as const, months: 6, careerField: "marketing" };
  it("filters by category and duration", () => {
    expect(matchSponsor(bundle("A"), { ...input, category: "trainee" }).categoryOffered).toBe(false);
    expect(matchSponsor(bundle("A"), { ...input, months: 18 })).toMatchObject({ duration: "outside", potentialMatch: false });
    expect(matchSponsor(bundle("A"), input)).toMatchObject({ duration: "fits", potentialMatch: true });
  });
  it("treats an unknown policy as unknown, and excludes sponsors that refuse self-placement", () => {
    expect(matchSponsor(bundle("A"), input).selfPlacement).toBe("unknown");
    const b = bundle("A"); b.sponsor_policies = [{ policy_key: "self_placement", value: "not_accepted", detail: null, source_id: null, verified_at: null }];
    expect(matchSponsor(b, input).potentialMatch).toBe(false);
  });
  it("applies a verified nationality restriction, but never assumes none exists", () => {
    const b = bundle("A"); b.sponsor_requirements = [{ id: "r", category: null, requirement_type: "nationality_restriction", description: "x", countries: ["Spain"], country_mode: "only", source_id: null }];
    expect(matchSponsor(b, { ...input, citizenship: "France" }).nationality).toBe("restricted");
    expect(matchSponsor(b, { ...input, citizenship: "spain" }).nationality).toBe("none_known");
  });
});

describe("student-status schedules and choice groups", () => {
  const cv = () => {
    const b = bundle("CV", { included: [] });
    const base = b.sponsor_fee_schedules[0];
    b.sponsor_fee_schedules = [
      { ...base, id: "stu", applies_to_education: ["current_student"], sponsor_fee_components: [comp(6, 112500), comp(6, 22000, "sevis_fee"), comp(6, 6000, "insurance", { per: "per_month", choice_group: "plan" }), comp(6, 10000, "insurance", { per: "per_month", choice_group: "plan", label: "Enhanced" })] },
      { ...base, id: "non", applies_to_education: ["recent_graduate"], sponsor_fee_components: [comp(6, 139500), comp(6, 22000, "sevis_fee"), comp(6, 6000, "insurance", { per: "per_month", choice_group: "plan" })] },
    ];
    return b;
  };
  it("picks the schedule for the applicant's student status", () => {
    expect(estimate(cv(), gov, { category: "intern", months: 6, residence: null, education: "current_student" }).lines[0].amountCents).toBe(112500);
    expect(estimate(cv(), gov, { category: "intern", months: 6, residence: null, education: "recent_graduate" }).lines[0].amountCents).toBe(139500);
  });
  it("does not guess when the status is unknown or unmatched", () => {
    const r = estimate(cv(), gov, { category: "intern", months: 6, residence: null, education: null });
    expect(r.complete).toBe(false);
    expect(r.lines[0].status).toBe("unknown");
    expect(r.notes.join(" ")).toMatch(/student status/);
  });
  it("uses the cheapest insurance option once, not the sum of all options", () => {
    const r = estimate(cv(), gov, { category: "intern", months: 6, residence: null, education: "current_student" });
    expect(r.lines.find((l) => l.key === "insurance")?.amountCents).toBe(36000);
    expect(r.notes.join(" ")).toMatch(/lowest-priced/);
  });
  it("treats known costs of an incomplete estimate as a floor and never gives a total", () => {
    const r = estimate(bundle("Z", { complete: false, included: ["sevis_fee", "insurance"] }), gov, { category: "intern", months: 6, residence: null });
    expect(r.totalCents).toBeNull();
    expect(r.knownTotalCents).toBe(175000 + 18500);
    expect(r.floorCents).toBe(175000 + 18500);
  });
  it("keeps unconfirmed government fees out of the floor", () => {
    const r = estimate(bundle("U", { confirmed: false }), gov, { category: "intern", months: 6, residence: null });
    expect(r.knownTotalCents).toBeGreaterThan(r.floorCents);
    expect(r.floorCents).toBe(175000);
  });
});
