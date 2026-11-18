"use client";
import { useState, useTransition } from "react";
import { updateTask } from "@/app/dashboard/actions";
import { STATUS_LABELS, type JourneyTask, type TaskStatus } from "@/lib/journey/types";
import { allowedStatuses, blockingTasks } from "@/lib/journey/progress";
import Link from "next/link";
import { DISPLAY_LABELS, availability, displayStatus } from "@/lib/engine/engine";

function TaskRow({ task, all }: { task: JourneyTask; all: JourneyTask[] }) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [notes, setNotes] = useState(task.notes);
  const [evidence, setEvidence] = useState(task.evidence_note);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const blocking = blockingTasks(task, all);

  if (!task.is_applicable) return <div className="task off"><strong>{task.title}</strong> <span className="chip">Not needed for your situation</span></div>;
  const save = () => start(async () => {
    const r = await updateTask({ taskId: task.id, status, notes, evidenceNote: evidence });
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error ?? "Could not save." });
  });
  return (
    <div className="task">
      <div className="row"><strong>{task.title}</strong>
        <span><span className={`chip ${displayStatus(task) === "externally_confirmed" || displayStatus(task) === "completed" ? "ok" : ""}`}>{DISPLAY_LABELS[displayStatus(task)]}</span>{" "}
        {task.external_verification && <span className="chip warn">Confirmed by {task.responsibility === "government" ? "a government office" : "your sponsor"}</span>}</span></div>
      {availability(task, all).reason && task.status !== "completed" && <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>{availability(task, all).reason}</p>}
      {task.action_href && task.status !== "completed" && <p style={{ margin: "6px 0 0" }}><Link href={task.action_href}>Open this step</Link></p>}
      {task.description && <p className="muted" style={{ margin: "4px 0 10px", fontSize: 14 }}>{task.description}</p>}
      {blocking.length > 0 && <p className="muted" style={{ fontSize: 13 }}>Waiting on: {blocking.map((b) => b.title).join(", ")}</p>}
      <div className="grid">
        <div><label htmlFor={`s-${task.id}`}>Status</label>
          <select id={`s-${task.id}`} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {allowedStatuses(task).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select></div>
        {task.requires_evidence && <div><label htmlFor={`e-${task.id}`}>Evidence (link, reference, or note)</label>
          <input id={`e-${task.id}`} value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={2000} /></div>}
        <div><label htmlFor={`n-${task.id}`}>Notes</label>
          <textarea id={`n-${task.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
      </div>
      <div style={{ marginTop: 8 }}><button className="btn ghost" type="button" onClick={save} disabled={pending}>{pending ? "Saving..." : "Save task"}</button>
        {msg && <span className={msg.ok ? "ok-msg" : "err"} role="status" style={{ marginLeft: 10 }}>{msg.text}</span>}</div>
    </div>
  );
}
export default function TaskList({ tasks, all }: { tasks: JourneyTask[]; all: JourneyTask[] }) {
  return <div>{tasks.map((t) => <TaskRow key={`${t.id}-${t.status}`} task={t} all={all} />)}</div>;
}
