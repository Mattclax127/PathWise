"use client";
import { useState, useTransition } from "react";
import { removeSavedApplication, updateApplication } from "@/app/journey/employer/actions";
import { J1_LABEL, type Opportunity } from "@/lib/engine/matching";

export interface WorkItem { id: string; status: string; notes: string; evidence_note: string; opportunity: Opportunity }
const LABELS: Record<string, string> = {
  saved: "Saved (research only)", preparing: "Preparing my application", submitted: "I sent my application", responded: "Employer replied",
  interview: "Interview", offer_received: "Written offer received", declined: "Declined", withdrawn: "Withdrawn",
};
const HINT: Record<string, string> = {
  responded: "A reply is a conversation. It does not make this company your host.",
  offer_received: "This records a host offer for you. It is not sponsor approval; your sponsor still has to review your host.",
  submitted: "Add proof that you sent it, like the email subject and date. PathWise does not send anything for you.",
};

function Row({ item }: { item: WorkItem }) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes);
  const [evidence, setEvidence] = useState(item.evidence_note);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();
  const needs = ["submitted", "responded", "interview", "offer_received"].includes(status);
  return (
    <div className="card">
      <div className="row"><strong>{item.opportunity.company_name}</strong>{item.opportunity.is_sample && <span className="chip sample">SAMPLE</span>}</div>
      <div className="muted" style={{ fontSize: 14 }}>{item.opportunity.title} · {item.opportunity.city}. {J1_LABEL[item.opportunity.j1_status]}.</div>
      <div className="grid" style={{ marginTop: 10 }}>
        <div><label htmlFor={`st-${item.id}`}>Status</label>
          <select id={`st-${item.id}`} value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        {needs && <div><label htmlFor={`ev-${item.id}`}>Evidence (link, email subject and date, or reference)</label>
          <input id={`ev-${item.id}`} value={evidence} maxLength={2000} onChange={(e) => setEvidence(e.target.value)} /></div>}
        <div><label htmlFor={`nt-${item.id}`}>Notes</label><textarea id={`nt-${item.id}`} rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      {HINT[status] && <p className="muted" style={{ fontSize: 13 }}>{HINT[status]}</p>}
      <div style={{ marginTop: 8 }}>
        <button className="btn ghost" type="button" disabled={pending} onClick={() => run(async () => {
          const r = await updateApplication({ applicationId: item.id, status: status as never, notes, evidenceNote: evidence });
          setMsg(r.ok ? { ok: true, text: "Saved. Your journey map is updated." } : { ok: false, text: r.error ?? "Could not save." }); })}>{pending ? "Saving…" : "Save"}</button>{" "}
        {item.status === "saved" && <button className="btn ghost" type="button" disabled={pending} onClick={() => run(async () => { const r = await removeSavedApplication(item.id); if (!r.ok) setMsg({ ok: false, text: r.error ?? "Could not remove." }); })}>Remove</button>}
        {msg && <span className={msg.ok ? "ok-msg" : "err"} role="status" style={{ marginLeft: 10 }}>{msg.text}</span>}
      </div>
    </div>
  );
}
export default function ApplicationWorkspace({ items }: { items: WorkItem[] }) {
  if (!items.length) return <p className="muted">Nothing saved yet. Save a listing above and it will appear here.</p>;
  return <div>{items.map((i) => <Row key={`${i.id}-${i.status}`} item={i} />)}</div>;
}
