"use client";
import { useState, useTransition } from "react";
import { claimExternalFact } from "@/app/journey/sponsor/actions";

export default function ClaimForm({ available, taken }: { available: Record<string, string>; taken: string[] }) {
  const options = Object.entries(available).filter(([k]) => !taken.includes(k));
  const [type, setType] = useState(options[0]?.[0] ?? "");
  const [evidence, setEvidence] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();
  if (!options.length) return <p className="muted">Everything is already recorded.</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setMsg(null); run(async () => {
      const r = await claimExternalFact({ factType: type as never, evidenceNote: evidence });
      setMsg(r.ok ? { ok: true, text: "Recorded. It now shows as awaiting confirmation." } : { ok: false, text: r.error ?? "Could not save." }); if (r.ok) setEvidence(""); }); }}>
      <div className="field"><label htmlFor="ft">What did you receive?</label>
        <select id="ft" value={type} onChange={(e) => setType(e.target.value)}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="field"><label htmlFor="fe">Evidence (email subject and date, reference number, or link)</label><input id="fe" value={evidence} maxLength={2000} onChange={(e) => setEvidence(e.target.value)} /></div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Record as awaiting confirmation"}</button>
      {msg && <span className={msg.ok ? "ok-msg" : "err"} role="status" style={{ marginLeft: 10 }}>{msg.text}</span>}
    </form>
  );
}
