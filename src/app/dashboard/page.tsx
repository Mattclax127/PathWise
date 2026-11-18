import Link from "next/link";
import { redirect } from "next/navigation";
import TaskList from "@/components/TaskList";
import { createClient } from "@/lib/supabase/server";
import { SECTIONS, STATUS_LABELS, type Journey, type JourneyTask } from "@/lib/journey/types";
import { nextAction, progressPercent, sectionSummary } from "@/lib/journey/progress";

const STATE_LABEL = { not_applicable: "Not needed", not_started: "Not started", in_progress: "In progress", completed: "Completed" } as const;

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: journey } = await supabase.from("journeys").select("id, destination_city, intended_category").maybeSingle<Journey>();
  if (!journey) redirect("/questionnaire");
  const { data } = await supabase.from("journey_tasks").select("*").eq("journey_id", journey.id).order("position");
  const tasks = (data ?? []) as JourneyTask[];
  const pct = progressPercent(tasks);
  const next = nextAction(tasks);
  const summaries = SECTIONS.map((s) => sectionSummary(tasks, s.key));
  const { data: opts } = await supabase.from("journey_sponsor_options").select("status, sponsors(name)").eq("journey_id", journey.id);
  const sponsorName = (o: { sponsors: unknown }) => (Array.isArray(o.sponsors) ? (o.sponsors[0] as { name?: string })?.name : (o.sponsors as { name?: string } | null)?.name) ?? "Sponsor";
  const preferred = (opts ?? []).find((o) => o.status === "preferred");
  const shortlist = (opts ?? []).filter((o) => o.status !== "preferred");

  return (
    <div className="wrap" style={{ padding: "28px 20px" }}>
      <div className="row"><h1>My J-1 Journey</h1><Link className="btn" href="/journey">Open journey map</Link></div>
      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Destination</div><strong style={{ fontSize: 22 }}>{journey.destination_city}</strong></div>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Intended category (your selection)</div><strong style={{ fontSize: 22 }}>J-1 {journey.intended_category === "intern" ? "Intern" : "Trainee"}</strong>
          <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>Subject to sponsor verification. Not an eligibility decision.</p></div>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Overall progress</div><strong style={{ fontSize: 22 }}>{pct}%</strong>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div></div>
      </div>
      <div className="card" style={{ background: "var(--lav)", borderColor: "#D8CFFF" }}>
        <strong>Recommended next action</strong>
        <p style={{ margin: "6px 0 0" }}>{next ? `${next.title} (${STATUS_LABELS[next.status]})` : "Nothing is waiting on you right now. Check steps awaiting third-party confirmation."}</p>
      </div>
      <div className="card">
        <div className="row"><strong>Sponsor shortlist</strong><Link href="/sponsors">Compare sponsors</Link></div>
        {preferred ? <p style={{ margin: "6px 0 0" }}>Preferred sponsor: <strong>{sponsorName(preferred)}</strong>. This is your choice only. Your sponsor must still accept your application.</p>
          : <p className="muted" style={{ margin: "6px 0 0" }}>No preferred sponsor yet.</p>}
        {shortlist.length > 0 && <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>Also saved: {shortlist.map(sponsorName).join(", ")}</p>}
      </div>
      <div className="grid">
        {summaries.filter((s) => ["employer_journey", "sponsor_journey", "document_preparation", "visa_application"].includes(s.key)).map((s) => (
          <div className="card" key={s.key}><div className="row"><strong>{s.label}</strong><span className={`chip ${s.state === "completed" ? "ok" : ""}`}>{STATE_LABEL[s.state]}</span></div>
            <div className="muted" style={{ fontSize: 13, margin: "6px 0" }}>{s.completed} of {s.total} done</div>
            <div className="bar"><div style={{ width: `${s.percent}%` }} /></div></div>
        ))}
      </div>
      {SECTIONS.map((sec, i) => (
        <section className="card" key={sec.key} id={sec.key}>
          <div className="row"><h2 style={{ fontSize: 20 }}>{sec.label}</h2><span className="chip">{summaries[i].completed} of {summaries[i].total}</span></div>
          <TaskList tasks={tasks.filter((t) => t.section === sec.key)} all={tasks} />
        </section>
      ))}
      <p className="muted" style={{ fontSize: 13 }}>Need to change your answers? <Link href="/questionnaire">Update them</Link>. Your progress is kept.</p>
    </div>
  );
}
