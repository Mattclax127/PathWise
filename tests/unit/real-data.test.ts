// Runs the cost engine against the REAL sponsor data files (data/sponsors/*.json), the same data that gets imported.
// Expected numbers below are computed by hand from each sponsor's published fee page (see each JSON file's sources).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scheduleRows } from "../../scripts/build-model.mjs";
import { estimate, rankByCost } from "@/lib/sponsors/compare";
import { matchSponsor } from "@/lib/sponsors/match";
import type { GovFee, SponsorBundle } from "@/lib/sponsors/types";

const root = process.cwd();
const gov = (JSON.parse(fs.readFileSync(path.join(root, "data/government-fees.json"), "utf8")).fees as GovFee[]).filter((g) => (g as unknown as { review_status: string }).review_status === "verified");
const dir = path.join(root, "data/sponsors");

/** Mirrors what Row Level Security exposes: only published, verified sponsors; only verified programs and schedules. */
function load(): SponsorBundle[] {
  const out: SponsorBundle[] = [];
  for (const f of fs.readdirSync(dir).filter((x: string) => x.endsWith(".json")).sort()) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (!(s.is_published && s.record_status === "verified")) continue;
    const id = s.slug;
    const sources = Object.entries(s.sources as Record<string, { url: string; info_type: string; verified_at: string; review_status: string; note: string | null }>)
      .map(([k, v]) => ({ id: `${id}:${k}`, ...v }));
    out.push({
      id, slug: id, name: s.name, website_url: s.website_url, contact_phone: s.contact_phone, address: s.address, designation_source_url: s.designation_source_url,
      designation_verified_at: s.designation_verified_at, is_sample: false, notes: s.notes,
      sponsor_programs: s.programs.filter((p: { record_status: string }) => p.record_status === "verified").map((p: Record<string, unknown>, i: number) => ({ id: `${id}:p${i}`, category: p.category, designation_evidence: p.designation_evidence ?? "sponsor_statement", fields: p.fields ?? [], min_duration_months: null, max_duration_months: p.max_duration_months ?? null, verified_at: p.verified_at, notes: p.notes })),
      sponsor_policies: s.policies.filter((p: { review_status: string }) => p.review_status === "verified").map((p: Record<string, unknown>) => ({ policy_key: p.policy_key, value: p.value, detail: p.detail, source_id: null, verified_at: p.verified_at })),
      sponsor_requirements: [], sponsor_sources: sources,
      sponsor_fee_schedules: scheduleRows(s).filter((r) => r.status === "verified").map((r, i) => ({
        id: `${id}:s${i}`, category: r.category, label: r.label, applies_to_residence: r.applies_to_residence, applies_to_education: r.applies_to_education, currency: "USD",
        is_itemized_complete: r.is_itemized_complete, inclusions_confirmed: r.inclusions_confirmed, notes: r.notes, verified_at: r.verified_at, source_id: `${id}:${r.source}`,
        sponsor_fee_components: r.components.map((c, j) => ({ id: `${id}:s${i}:c${j}`, ...c })) as never, sponsor_fee_inclusions: r.inclusions,
      })),
    } as unknown as SponsorBundle);
  }
  return out;
}
const bundles = load();
const get = (slug: string) => bundles.find((b) => b.slug === slug)!;
const run = (slug: string, o: { category?: "intern" | "trainee"; months: number; residence?: string | null; education?: string | null }) =>
  estimate(get(slug), gov, { category: o.category ?? "intern", months: o.months, residence: o.residence ?? null, education: o.education ?? null });
const line = (r: ReturnType<typeof run>, k: string) => r.lines.find((l) => l.key === k)!;

describe("published sponsors", () => {
  it("includes only published, verified sponsors", () => {
    expect(bundles.map((b) => b.slug).sort()).toEqual(["american-immigration-council", "cetusa", "cultural-vistas", "interexchange", "spirit-cultural-exchange"]);
  });
  it("offers several sponsors for Intern and for Trainee", () => {
    const offers = (cat: "intern" | "trainee") => bundles.filter((b) => matchSponsor(b, { category: cat, months: 6, careerField: "business" }).categoryOffered).map((b) => b.slug).sort();
    expect(offers("intern")).toEqual(["american-immigration-council", "cetusa", "cultural-vistas", "interexchange", "spirit-cultural-exchange"]);
    expect(offers("trainee")).toEqual(["american-immigration-council", "cultural-vistas", "spirit-cultural-exchange"]); // InterExchange trainee is held back for review
  });
  it("stores only whole-cent integers", () => {
    for (const b of bundles) for (const s of b.sponsor_fee_schedules) for (const c of s.sponsor_fee_components) if (c.amount_cents !== null) expect(Number.isInteger(c.amount_cents)).toBe(true);
  });
});

describe("Cultural Vistas (complete itemized list)", () => {
  it("non-student, 6 months: 1,395 + SEVIS 220 + visa 185 + insurance 60 x 6", () => {
    const r = run("cultural-vistas", { months: 6, education: "recent_graduate" });
    expect(r.complete).toBe(true);
    expect(r.totalCents).toBe(139500 + 22000 + 18500 + 36000);
  });
  it("student, 6 months uses the student fee", () => {
    expect(run("cultural-vistas", { months: 6, education: "current_student" }).totalCents).toBe(112500 + 22000 + 18500 + 36000);
  });
  it("trainee, non-student, 15 months uses the 13-18 month tier", () => {
    expect(run("cultural-vistas", { category: "trainee", months: 15, education: "graduate_with_experience" }).totalCents).toBe(189500 + 22000 + 18500 + 6000 * 15);
  });
  it("stays incomplete when student status is unknown or the tier is not offered", () => {
    expect(run("cultural-vistas", { months: 6 }).complete).toBe(false);
    const r = run("cultural-vistas", { category: "trainee", months: 15, education: "current_student" });
    expect(line(r, "sponsor_fee").status).toBe("unknown");
    expect(r.complete).toBe(false);
  });
});

describe("InterExchange (SEVIS and insurance included; visa fee separate)", () => {
  it("France resident, 6 months: 1,650 + visa 185, never adding SEVIS or insurance", () => {
    const r = run("interexchange", { months: 6, residence: "France" });
    expect(line(r, "sponsor_fee").amountCents).toBe(165000);
    expect(line(r, "sevis_fee").status).toBe("included");
    expect(line(r, "insurance").status).toBe("included");
    expect(r.knownTotalCents).toBe(165000 + 18500);
    expect(r.complete).toBe(false); // sponsor mentions unnamed miscellaneous fees
    expect(r.totalCents).toBeNull();
  });
  it("other residence uses the standard schedule", () => expect(line(run("interexchange", { months: 6, residence: "Spain" }), "sponsor_fee").amountCents).toBe(175000));
  it("matches the published 12 and 18 month prices", () => {
    expect(line(run("interexchange", { months: 12, residence: "Spain" }), "sponsor_fee").amountCents).toBe(235000);
    expect(line(run("interexchange", { category: "trainee", months: 18, residence: "Spain" }), "sponsor_fee").status).toBe("unknown"); // trainee schedule held back
  });
});

describe("Spirit and American Immigration Council", () => {
  it("Spirit 6 months: 1,415 + SEVIS 220 + visa 185, insurance included, flagged incomplete", () => {
    const r = run("spirit-cultural-exchange", { months: 6 });
    expect(r.knownTotalCents).toBe(141500 + 22000 + 18500);
    expect(line(r, "insurance").status).toBe("included");
    expect(r.complete).toBe(false);
  });
  it("Spirit uses the 13-18 month tier for trainees", () => expect(line(run("spirit-cultural-exchange", { category: "trainee", months: 15 }), "sponsor_fee").amountCents).toBe(225500));
  it("AIC 6 months: 1,550 + review 550 + SEVIS 220 + insurance 100 x 6 + visa 185, flagged incomplete", () => {
    const r = run("american-immigration-council", { months: 6 });
    expect(r.knownTotalCents).toBe(155000 + 55000 + 22000 + 60000 + 18500);
    expect(r.floorCents).toBe(155000 + 55000 + 22000 + 60000); // visa fee is unconfirmed, so it is not in the floor
    expect(r.complete).toBe(false);
    expect(r.unconfirmed).toContain("visa_fee");
  });
});

describe("comparing across real sponsors", () => {
  it("ranks only complete estimates; incomplete ones follow ordered by known floor and are never ranked", () => {
    const results = bundles.map((b) => estimate(b, gov, { category: "intern", months: 6, residence: "France", education: "recent_graduate" }));
    const r = rankByCost(results);
    expect(r.ranked.map((x) => x.sponsorId)).toEqual(["cultural-vistas"]);
    expect(r.lowestCompleteId).toBe("cultural-vistas");
    expect(r.incomplete.every((x) => x.totalCents === null)).toBe(true);
    const floors = r.incomplete.map((x) => (x.floorCents === 0 ? Infinity : x.floorCents));
    expect(floors).toEqual([...floors].sort((a, b) => a - b));
    expect(r.incomplete.map((x) => x.sponsorId)).toEqual(["spirit-cultural-exchange", "interexchange", "american-immigration-council", "cetusa"]);
  });
  it("CETUSA has no confirmed fees and is reported as unknown, not zero", () => {
    const r = run("cetusa", { months: 6 });
    expect(r.complete).toBe(false);
    expect(line(r, "sponsor_fee")).toMatchObject({ status: "unknown", amountCents: null });
    expect(r.floorCents).toBe(0); // nothing confirmed, so no misleading "at least" figure
  });
});
