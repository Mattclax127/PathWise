import Link from "next/link";
import { redirect } from "next/navigation";
import ClaimForm from "@/components/ClaimForm";
import TaskList from "@/components/TaskList";
import { createClient } from "@/lib/supabase/server";
import type { JourneyTask } from "@/lib/journey/types";

export const metadata = { title: "Sponsor journey | PathWise" };
const STATUS = { saved: "Saved", shortlisted: "Shortlisted", preferred: "Preferred (your choice only)" } as const;
const FACT_LABEL: Record<string, string> = {
  confirm_category_with_sponsor: "Program category confirmed by a sponsor", sponsor_accepts_application: "Sponsor accepted your application",
  sponsor_reviews_host: "Sponsor reviewed your host and training plan", sponsor_issues_documents: "Sponsor issued your program documents", visa_decision: "Visa decision",
};

export default async function SponsorJourney() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: journey } = await supabase.from("journeys").select("id").maybeSingle();
  if (!journey) redirect("/questionnaire");
  const [{ data: opts }, { data: facts }, { data: t }] = await Promise.all([
    supabase.from("journey_sponsor_options").select("status, sponsors(name, slug)").eq("journey_id", journey.id),
    supabase.from("external_facts").select("fact_type, status, claimed_at, confirmed_at").order("claimed_at"),
    supabase.from("journey_tasks").select("*").eq("journey_id", journey.id).eq("section", "sponsor_journey").order("position"),
  ]);
  const name = (o: { sponsors: unknown }) => { const s = Array.isArray(o.sponsors) ? o.sponsors[0] : o.sponsors; return (s as { name?: string } | null)?.name ?? "Sponsor"; };
  const tasks = (t ?? []) as JourneyTask[];
  const open = new Set((facts ?? []).filter((f) => f.status !== "rejected").map((f) => f.fact_type));
  return (
    <div className="wrap" style={{ padding: "24px 20px", maxWidth: 820 }}>
      <div className="row"><h1>Sponsor journey</h1><Link href="/journey">Back to map</Link></div>
      <p className="muted">Choosing a sponsor records your choice only. Only a designated sponsor can accept you, review your host, or issue a DS-2019. PathWise does not contact sponsors for you.</p>
      <div className="card">
        <div className="row"><strong>Your saved sponsors</strong><Link href="/sponsors">Compare sponsors</Link></div>
        {(opts ?? []).length === 0 ? <p className="muted" style={{ margin: "6px 0 0" }}>None saved yet. Compare sponsors and save the ones you want.</p>
          : <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{(opts ?? []).map((o, i) => <li key={i}>{name(o)} <span className="chip">{STATUS[o.status as keyof typeof STATUS]}</span></li>)}</ul>}
      </div>
      <div className="card">
        <strong>Confirmations</strong>
        {(facts ?? []).length === 0 ? <p className="muted" style={{ margin: "6px 0 0" }}>Nothing recorded yet.</p>
          : <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{(facts ?? []).map((f, i) => <li key={i}>{FACT_LABEL[f.fact_type]}: <span className={`chip ${f.status === "confirmed" ? "ok" : f.status === "rejected" ? "warn" : ""}`}>
            {f.status === "claimed" ? "Awaiting confirmation" : f.status === "confirmed" ? "Externally confirmed" : "Not confirmed"}</span></li>)}</ul>}
        <h3 style={{ fontSize: 16, margin: "16px 0 6px" }}>Record something you received</h3>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>This saves your evidence and marks the step as awaiting confirmation. It is not confirmed until PathWise verifies it with the source.</p>
        <ClaimForm available={FACT_LABEL} taken={[...open]} />
      </div>
      <div className="card"><h2 style={{ fontSize: 20 }}>Sponsor steps</h2><TaskList tasks={tasks} all={tasks} /></div>
    </div>
  );
}
