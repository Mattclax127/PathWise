"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { removeSponsorOption, saveSponsorOption } from "@/app/sponsors/actions";
import { estimate, rankByCost, type CostResult } from "@/lib/sponsors/compare";
import { filterSponsors, SELF_PLACEMENT_LABEL, type Filters } from "@/lib/sponsors/match";
import { formatCents } from "@/lib/sponsors/money";
import type { Category, GovFee, SelfPlacement, SponsorBundle } from "@/lib/sponsors/types";

type Status = "saved" | "shortlisted" | "preferred";
interface Defaults { category: Category; months: number; careerField: string; residence: string; citizenship: string; education: string }
interface Props { bundles: SponsorBundle[]; gov: GovFee[]; defaults: Defaults | null; saved: Record<string, Status>; signedIn: boolean; hasJourney: boolean }

export default function SponsorExplorer({ bundles, gov, defaults, saved: initialSaved, signedIn, hasJourney }: Props) {
  const [filters, setFilters] = useState<Filters>({ search: "", category: defaults?.category ?? "intern", selfPlacement: "any", potentialOnly: false });
  const [months, setMonths] = useState(defaults?.months ?? 6);
  const [residence, setResidence] = useState(defaults?.residence ?? "");
  const [education, setEducation] = useState(defaults?.education ?? "");
  const [compare, setCompare] = useState<string[]>([]);
  const [saved, setSaved] = useState(initialSaved);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const input = { category: filters.category, months, careerField: defaults?.careerField ?? "other", citizenship: defaults?.citizenship ?? null };
  const rows = useMemo(() => filterSponsors(bundles, filters, input).map((r) => ({
    ...r, cost: estimate(r.bundle, gov, { category: filters.category, months, residence: residence.trim() || null, education: education || null }),
  })), [bundles, gov, filters, months, residence, education, defaults]);
  const ranking = useMemo(() => rankByCost(rows.map((r) => r.cost)), [rows]);
  const order = [...ranking.ranked, ...ranking.incomplete].map((r) => r.sponsorId);
  const sorted = [...rows].sort((a, b) => order.indexOf(a.bundle.id) - order.indexOf(b.bundle.id));
  const rankOf = (c: CostResult) => ranking.ranked.find((r) => r.sponsorId === c.sponsorId)?.rank ?? null;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, apply: () => void) =>
    start(async () => { const r = await fn(); if (r.ok) { apply(); setMsg(null); } else setMsg(r.error ?? "Something went wrong."); });
  const save = (id: string, status: Status) => act(() => saveSponsorOption({ sponsorId: id, status }), () =>
    setSaved((s) => { const next = { ...s, [id]: status }; if (status === "preferred") for (const k of Object.keys(next)) if (k !== id && next[k] === "preferred") next[k] = "shortlisted"; return next; }));
  const remove = (id: string) => act(() => removeSponsorOption(id), () => setSaved((s) => { const n = { ...s }; delete n[id]; return n; }));
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c));
  const picked = rows.filter((r) => compare.includes(r.bundle.id));

  return (
    <div>
      <div className="card"><div className="grid">
        <div><label htmlFor="sr">Search by name</label><input id="sr" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
        <div><label htmlFor="ct">Program</label><select id="ct" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value as Category })}><option value="intern">Intern</option><option value="trainee">Trainee</option></select></div>
        <div><label htmlFor="mo">Length (months)</label><input id="mo" type="number" min={1} max={18} value={months} onChange={(e) => setMonths(Math.min(18, Math.max(1, Number(e.target.value) || 1)))} /></div>
        <div><label htmlFor="rs">Country of permanent residence</label><input id="rs" value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="Some sponsors price by country" /></div>
        <div><label htmlFor="ed">Student status (some sponsors price by it)</label><select id="ed" value={education} onChange={(e) => setEducation(e.target.value)}><option value="">Not set</option><option value="current_student">Current student</option><option value="recent_graduate">Recent graduate</option><option value="graduate_with_experience">Graduate with experience</option></select></div>
        <div><label htmlFor="sp">Self-arranged placement</label><select id="sp" value={filters.selfPlacement} onChange={(e) => setFilters({ ...filters, selfPlacement: e.target.value as Filters["selfPlacement"] })}>
          <option value="any">Any policy</option>{(["accepted", "required", "conditional", "not_accepted", "unknown"] as SelfPlacement[]).map((v) => <option key={v} value={v}>{SELF_PLACEMENT_LABEL[v]}</option>)}</select></div>
        <div style={{ display: "flex", alignItems: "end" }}><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={filters.potentialOnly} onChange={(e) => setFilters({ ...filters, potentialOnly: e.target.checked })} />Potential matches only</label></div>
      </div></div>
      {!signedIn && <p className="muted"><Link href="/login?next=/sponsors">Log in</Link> to save sponsors and use your questionnaire answers.</p>}
      {signedIn && !hasJourney && <p className="muted"><Link href="/questionnaire">Finish the questionnaire</Link> to save sponsors to your journey.</p>}
      {msg && <p className="err" role="alert">{msg}</p>}
      {rows.length === 0 && <div className="card"><strong>No verified sponsors match these filters.</strong><p className="muted">Try another program or policy. More sponsors are added as they are verified.</p></div>}

      {sorted.map(({ bundle: b, match, cost }) => {
        const status = saved[b.id]; const rank = rankOf(cost);
        return (
          <div className="card" key={b.id}>
            <div className="row"><h2 style={{ fontSize: 20 }}>{b.name}</h2>
              {b.sponsor_programs.find((p) => p.category === filters.category)?.designation_evidence === "state_directory"
                ? <span className="chip ok">On State Dept list, checked {b.designation_verified_at}</span>
                : <span className="chip warn">Designation stated by sponsor; confirm on the State Dept list</span>}</div>
            <p className="muted" style={{ margin: "4px 0 8px", fontSize: 14 }}>
              {b.is_sample && <span className="chip warn">Sample data </span>} {SELF_PLACEMENT_LABEL[match.selfPlacement]}
              {match.duration === "unknown" ? " · Length limit not confirmed" : ""}
              {match.potentialMatch ? " · Potential match, confirm with sponsor" : ""}
            </p>
            {match.reasons.length > 0 && <p className="err" style={{ fontSize: 13 }}>{match.reasons.join(" ")}</p>}
            <div className="row">
              <div><div className="muted" style={{ fontSize: 13 }}>Estimated comparable total ({months} months)</div>
                <strong style={{ fontSize: 24 }}>{cost.complete ? formatCents(cost.totalCents) : cost.floorCents > 0 ? `At least ${formatCents(cost.floorCents)}` : "Unknown"}</strong>
                {!cost.complete && <span className="chip warn" style={{ marginLeft: 8 }}>Incomplete estimate, not a total</span>}
                {rank === 1 && <span className="chip ok" style={{ marginLeft: 8 }}>Lowest complete estimate</span>}
                {!cost.complete && <div className="muted" style={{ fontSize: 13 }}>Counts only costs that are confirmed. {cost.unknownKeys.length ? `Unknown: ${cost.unknownKeys.join(", ")}. ` : ""}{cost.unconfirmed.length ? `Unconfirmed: ${cost.unconfirmed.join(", ")}. ` : ""}{cost.notes[0] ?? ""}</div>}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={compare.includes(b.id)} onChange={() => toggleCompare(b.id)} disabled={!compare.includes(b.id) && compare.length >= 3} />Compare</label>
                {signedIn && hasJourney && (<>
                  <button className="btn ghost" disabled={pending} onClick={() => save(b.id, "saved")}>{status === "saved" ? "Saved" : "Save"}</button>
                  <button className="btn ghost" disabled={pending} onClick={() => save(b.id, "shortlisted")}>{status === "shortlisted" ? "Shortlisted" : "Shortlist"}</button>
                  <button className="btn" disabled={pending} onClick={() => save(b.id, "preferred")}>{status === "preferred" ? "Preferred" : "Mark preferred"}</button>
                  {status && <button className="btn ghost" disabled={pending} onClick={() => remove(b.id)}>Remove</button>}</>)}
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
              {b.website_url && <a href={b.website_url} target="_blank" rel="noreferrer">Sponsor site</a>} {cost.sourceUrl && <>· <a href={cost.sourceUrl} target="_blank" rel="noreferrer">Fee source</a> checked {cost.verifiedAt}</>}
              {b.designation_source_url && <> · <a href={b.designation_source_url} target="_blank" rel="noreferrer">State Department listing</a></>}
            </p>
          </div>
        );
      })}

      {picked.length >= 2 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <h2 style={{ fontSize: 20 }}>Side-by-side ({months} months, {filters.category})</h2>
          <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 14, marginTop: 10 }}>
            <thead><tr style={{ textAlign: "left" }}><th style={{ padding: 8 }}> </th>{picked.map((p) => <th key={p.bundle.id} style={{ padding: 8 }}>{p.bundle.name}</th>)}</tr></thead>
            <tbody>
              {(["sponsor_fee", "processing", "other_mandatory", "sevis_fee", "visa_fee", "insurance"] as const).map((k) => (
                picked.some((p) => p.cost.lines.some((l) => l.key === k)) && <tr key={k}>
                  <td style={{ padding: 8, borderTop: "1px solid var(--line)", fontWeight: 600 }}>{picked.flatMap((p) => p.cost.lines).find((l) => l.key === k)!.label}</td>
                  {picked.map((p) => { const l = p.cost.lines.find((x) => x.key === k);
                    return <td key={p.bundle.id} style={{ padding: 8, borderTop: "1px solid var(--line)" }}>{!l ? "Not itemized" : l.status === "included" ? "Included" : l.status === "unknown" ? "Unknown" : formatCents(l.amountCents)}{l?.note && <div className="muted" style={{ fontSize: 12 }}>{l.note}</div>}</td>; })}
                </tr>))}
              <tr><td style={{ padding: 8, borderTop: "2px solid var(--navy)", fontWeight: 700 }}>Comparable total</td>
                {picked.map((p) => <td key={p.bundle.id} style={{ padding: 8, borderTop: "2px solid var(--navy)", fontWeight: 700 }}>{p.cost.complete ? formatCents(p.cost.totalCents) : p.cost.floorCents > 0 ? `At least ${formatCents(p.cost.floorCents)} (incomplete, not a total)` : "Unknown (incomplete)"}</td>)}</tr>
              <tr><td style={{ padding: 8, fontWeight: 600 }}>Included services</td>{picked.map((p) => <td key={p.bundle.id} style={{ padding: 8 }}>{p.cost.includedServices.length ? p.cost.includedServices.join(", ") : "Not confirmed"}</td>)}</tr>
              <tr><td style={{ padding: 8, fontWeight: 600 }}>Source and date</td>{picked.map((p) => <td key={p.bundle.id} style={{ padding: 8 }}>{p.cost.sourceUrl ? <><a href={p.cost.sourceUrl} target="_blank" rel="noreferrer">Fee page</a> · {p.cost.verifiedAt}</> : "No verified fee source"}</td>)}</tr>
            </tbody>
          </table>
          {picked.some((p) => p.cost.notes.length > 0) && <ul className="muted" style={{ fontSize: 13 }}>{picked.flatMap((p) => p.cost.notes.map((n, i) => <li key={`${p.bundle.id}${i}`}><strong>{p.bundle.name}:</strong> {n}</li>))}</ul>}
          <p className="muted" style={{ fontSize: 13 }}>Incomplete estimates are never ranked as cheapest. Relocation and living costs are in the financial planner, not here. Other government charges may apply, for example a visa issuance (reciprocity) fee for some nationalities; check <a href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html" target="_blank" rel="noreferrer">travel.state.gov</a>.</p>
        </div>
      )}
    </div>
  );
}
