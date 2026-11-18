"use client";
import { useRef, useState, useTransition } from "react";
import { dismissOpportunity, saveOpportunity, undoDismiss } from "@/app/journey/employer/actions";
import { J1_LABEL, type Opportunity } from "@/lib/engine/matching";

const THRESHOLD = 90;

/** Swipe right to save, left to dismiss. The Save and Dismiss buttons (and arrow keys) do exactly the same thing. */
export default function OpportunityDeck({ initial }: { initial: Opportunity[] }) {
  const [queue, setQueue] = useState(initial);
  const [lastDismissed, setLast] = useState<Opportunity | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const [, run] = useTransition();
  const top = queue[0];

  const save = () => { if (!top) return; const o = top; setQueue((q) => q.slice(1)); setDx(0); setMsg(`Saved ${o.company_name} to your workspace.`);
    run(async () => { const r = await saveOpportunity(o.id); if (!r.ok) { setQueue((q) => [o, ...q]); setMsg(r.error ?? "Could not save."); } }); };
  const dismiss = () => { if (!top) return; const o = top; setQueue((q) => q.slice(1)); setDx(0); setLast(o); setMsg(`Dismissed ${o.company_name}.`);
    run(async () => { const r = await dismissOpportunity(o.id); if (!r.ok) { setQueue((q) => [o, ...q]); setLast(null); setMsg(r.error ?? "Could not dismiss."); } }); };
  const undo = () => { const o = lastDismissed; if (!o) return; setLast(null); setQueue((q) => [o, ...q]); setMsg(`Brought back ${o.company_name}.`);
    run(async () => { const r = await undoDismiss(o.id); if (!r.ok) setMsg(r.error ?? "Could not undo."); }); };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === "ArrowRight") { e.preventDefault(); save(); } if (e.key === "ArrowLeft") { e.preventDefault(); dismiss(); } };

  return (
    <div>
      <div role="status" aria-live="polite" className="muted" style={{ minHeight: 24, fontSize: 14 }}>{msg}{lastDismissed && <> <button className="btn ghost" type="button" onClick={undo} style={{ minHeight: 32, padding: "4px 12px" }}>Undo dismiss</button></>}</div>
      {top ? (
        <div className="dz" onKeyDown={onKey}
          onPointerDown={(e) => { start.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
          onPointerUp={() => { const d = dx; start.current = null; if (d > THRESHOLD) save(); else if (d < -THRESHOLD) dismiss(); else setDx(0); }}
          onPointerCancel={() => { start.current = null; setDx(0); }}>
          <article className="card swipe" tabIndex={0} aria-label={`${top.title} at ${top.company_name}. Press right arrow to save, left arrow to dismiss.`}
            style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, opacity: 1 - Math.min(Math.abs(dx) / 400, 0.4) }}>
            <div className="row"><h2 style={{ fontSize: 20 }}>{top.title}</h2>{top.is_sample && <span className="chip sample">SAMPLE</span>}</div>
            <p style={{ margin: "4px 0" }}><strong>{top.company_name}</strong> · {top.city} · {top.career_field}</p>
            <p>{top.description}</p>
            <p className="muted" style={{ fontSize: 13 }}>{J1_LABEL[top.j1_status]}. {top.source_label}</p>
          </article>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn ghost" type="button" onClick={dismiss} style={{ flex: 1 }} aria-label={`Dismiss ${top.company_name}`}>Dismiss</button>
            <button className="btn" type="button" onClick={save} style={{ flex: 1 }} aria-label={`Save ${top.company_name}`}>Save</button>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>{queue.length} left. Swipe, use the buttons, or press the arrow keys.</p>
        </div>
      ) : <div className="card"><strong>No more listings right now.</strong><p className="muted" style={{ margin: "4px 0 0" }}>Dismissed a listing by mistake? Use Undo above while it is showing.</p></div>}
    </div>
  );
}
