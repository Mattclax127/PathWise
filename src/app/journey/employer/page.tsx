import Link from "next/link";
import { redirect } from "next/navigation";
import ApplicationWorkspace from "@/components/ApplicationWorkspace";
import OpportunityDeck from "@/components/OpportunityDeck";
import ResumeSetup from "@/components/ResumeSetup";
import { createClient } from "@/lib/supabase/server";
import { rankOpportunities, type Opportunity } from "@/lib/engine/matching";

export const metadata = { title: "Employer Discovery | PathWise" };

export default async function EmployerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: journey } = await supabase.from("journeys").select("id").maybeSingle();
  if (!journey) redirect("/questionnaire");
  const [{ data: q }, { data: opps }, { data: apps }, { data: dismissed }, { data: state }, { data: resume }] = await Promise.all([
    supabase.from("questionnaire_responses").select("destination_city, career_field, host_state").maybeSingle(),
    supabase.from("opportunities").select("*"),
    supabase.from("employer_applications").select("id, opportunity_id, status, notes, evidence_note").order("created_at", { ascending: false }),
    supabase.from("opportunity_dismissals").select("opportunity_id"),
    supabase.from("journey_state").select("resume_choice").eq("journey_id", journey.id).maybeSingle(),
    supabase.from("resumes").select("kind, file_name").maybeSingle(),
  ]);
  const all = (opps ?? []) as Opportunity[];
  const byId = new Map(all.map((o) => [o.id, o]));
  const hidden = new Set([...(apps ?? []).map((a) => a.opportunity_id), ...(dismissed ?? []).map((d) => d.opportunity_id)]);
  const deck = rankOpportunities(all, { destination_city: q?.destination_city ?? "", career_field: q?.career_field ?? "" }, hidden);
  const workspace = (apps ?? []).flatMap((a) => { const o = byId.get(a.opportunity_id); return o ? [{ ...a, opportunity: o }] : []; });

  return (
    <div className="wrap" style={{ padding: "24px 20px", maxWidth: 820 }}>
      {!state?.resume_choice && <ResumeSetup />}
      <div className="row"><h1>Employer Discovery</h1><Link href="/journey">Back to map</Link></div>
      <p className="muted">Saving a listing is research only. A reply from a company is not a host, and none of this is sponsor approval.</p>
      {q?.host_state === "offer" && <p className="chip">You said you already have a written offer. You can still track other applications here.</p>}
      <div className="card" style={{ background: "#FFF9E8", borderColor: "#F2DFA5" }}>
        <strong>Sample listings</strong>
        <p style={{ margin: "4px 0 0", fontSize: 14 }}>The listings below are fictional samples for previewing PathWise. They are not real jobs, and no real company has agreed to host J-1 participants.</p>
      </div>
      {resume && <p className="muted" style={{ fontSize: 13 }}>Résumé: {resume.kind === "uploaded" ? `uploaded (${resume.file_name})` : "built in PathWise"}.</p>}
      <OpportunityDeck initial={deck} />
      <h2 style={{ margin: "28px 0 8px" }}>Your employer workspace</h2>
      <ApplicationWorkspace items={workspace} />
    </div>
  );
}
