import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import TaskList from "@/components/TaskList";
import { createClient } from "@/lib/supabase/server";
import { progressSummary } from "@/lib/engine/engine";
import { SECTIONS, type Journey, type JourneyTask } from "@/lib/journey/types";

// Stages that have their own purpose-built workspace live elsewhere (employer, sponsor).
const OWN_PAGE = new Set(["employer_journey", "sponsor_journey"]);

export default async function StagePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const meta = SECTIONS.find((s) => s.key === section);
  if (!meta || OWN_PAGE.has(section)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: journey } = await supabase.from("journeys").select("id").maybeSingle<Pick<Journey, "id">>();
  if (!journey) redirect("/questionnaire");
  const { data } = await supabase.from("journey_tasks").select("*").eq("journey_id", journey.id).order("position");
  const all = (data ?? []) as JourneyTask[];
  const mine = all.filter((t) => t.section === section);
  const s = progressSummary(mine);
  return (
    <main className="wrap" style={{ padding: "24px 20px", maxWidth: 760 }}>
      <p><Link href="/journey">← Back to journey map</Link></p>
      <h1>{meta.label}</h1>
      <p className="muted" style={{ margin: "6px 0 16px" }}>{s.prepared.done} of {s.prepared.total} tasks prepared{s.official.total ? ` · ${s.official.done} of ${s.official.total} official milestones confirmed` : ""}</p>
      {mine.length === 0 ? <div className="card">Nothing here applies to you right now.</div> : <TaskList tasks={mine} all={all} />}
    </main>
  );
}
