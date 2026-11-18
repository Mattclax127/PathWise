import Link from "next/link";
import { redirect } from "next/navigation";
import JourneyView from "@/components/JourneyView";
import { buildMapModel } from "@/lib/map/mapModel";
import { createClient } from "@/lib/supabase/server";
import { focus, progressSummary } from "@/lib/engine/engine";
import type { Journey, JourneyTask } from "@/lib/journey/types";

export const metadata = { title: "My journey map | PathWise" };

export default async function JourneyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: journey } = await supabase.from("journeys").select("id, destination_city, intended_category").maybeSingle<Journey>();
  if (!journey) redirect("/questionnaire");
  const [{ data: t }] = await Promise.all([
    supabase.from("journey_tasks").select("*").eq("journey_id", journey.id).order("position"),
  ]);
  const tasks = (t ?? []) as JourneyTask[];
  const model = buildMapModel(tasks);
  const summary = progressSummary(tasks);
  const { primary, parallel } = focus(tasks);
  return (
    <div className="wrap" style={{ padding: "24px 20px" }}>
      <div className="row"><h1>My journey map</h1><Link href="/dashboard">Open dashboard</Link></div>
      <p className="muted" style={{ margin: "4px 0 16px" }}>Destination: <strong>{journey.destination_city}</strong> · J-1 {journey.intended_category === "intern" ? "Intern" : "Trainee"} (your selection, not an eligibility decision)</p>
      <div className="grid">
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Tasks prepared</div><strong style={{ fontSize: 22 }}>{summary.prepared.done} of {summary.prepared.total}</strong>
          <div className="bar" role="progressbar" aria-label="Tasks prepared" aria-valuenow={summary.prepared.percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${summary.prepared.percent}%` }} /></div></div>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Official milestones confirmed</div><strong style={{ fontSize: 22 }}>{summary.official.done} of {summary.official.total}</strong>
          <div className="bar" role="progressbar" aria-label="Official milestones confirmed" aria-valuenow={summary.official.percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${summary.official.percent}%` }} /></div>
          <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>Confirmed by a sponsor or government office, not by you.</p></div>
        <div className="card" style={{ background: "var(--lav)", borderColor: "#D8CFFF" }}><strong>Next action</strong>
          <p style={{ margin: "6px 0 0" }}>{primary ? primary.title : "Nothing is waiting on you right now."}</p>
          {primary?.action_href && <p style={{ margin: "8px 0 0" }}><Link className="btn" href={primary.action_href}>Go</Link></p>}
          {parallel.length > 0 && <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>Also open: {parallel.map((p) => p.title).join(" · ")}</p>}</div>
      </div>
      <JourneyView model={model} tasks={tasks} journeyId={journey.id} />
    </div>
  );
}
