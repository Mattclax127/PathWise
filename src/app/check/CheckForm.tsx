"use client";
import { useActionState, useMemo, useState } from "react";
import { assessFit, type ApplicantStatus } from "@/lib/waitlist/fit";
import { joinWaitlist, type JoinResult } from "./actions";

const opt = (v: string, l: string) => ({ v, l });
const STATUS = [opt("student", "I'm currently studying (degree or certificate, outside the U.S.)"), opt("recent_grad", "I graduated less than 12 months ago"), opt("grad_experience", "I graduated more than a year ago and have at least a year of work experience"), opt("experience_only", "I have 5 or more years of work experience, no degree"), opt("other", "None of these")];

export default function CheckForm() {
  const [a, setA] = useState({ residence: "outside_us", status: "student", english: "good", months: "6", field: "other" });
  const [step, setStep] = useState<"check" | "result">("check");
  const [state, action, pending] = useActionState<JoinResult | null, FormData>(joinWaitlist, null);
  const months = Math.min(24, Math.max(1, Number(a.months) || 1));
  const fit = useMemo(() => assessFit({ residence: a.residence as "outside_us" | "in_us", status: a.status as ApplicantStatus, english: a.english as "good" | "limited", months, hospitality: a.field === "hospitality" }), [a, months]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setA({ ...a, [k]: e.target.value });

  if (state?.ok) return <div className="card" role="status"><h2>You're on the list.</h2><p className="muted">{state.already ? "That email was already signed up. " : ""}We'll email you when early access opens. We will not share your email, and PathWise will never contact a sponsor or employer for you without asking.</p></div>;

  if (step === "check") return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); setStep("result"); }}>
      <h2>Quick check</h2>
      <p className="muted">Six questions. No account needed. This is a self-check, not an eligibility decision.</p>
      <label>Where do you live now?<select value={a.residence} onChange={set("residence")}><option value="outside_us">Outside the United States</option><option value="in_us">In the United States</option></select></label>
      <label>Which describes you best?<select value={a.status} onChange={set("status")}>{STATUS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
      <label>Your English for a workplace<select value={a.english} onChange={set("english")}><option value="good">Comfortable</option><option value="limited">Still learning</option></select></label>
      <label>Field<select value={a.field} onChange={set("field")}><option value="other">Business, tech, engineering, other</option><option value="hospitality">Hospitality or tourism</option></select></label>
      <label>How many months do you want to stay? (1 to 24)<input type="number" min={1} max={24} value={a.months} onChange={set("months")} /></label>
      <button className="btn" type="submit">See my result</button>
    </form>
  );

  return (
    <div>
      <div className="card"><h2>{fit.headline}</h2><ul>{fit.notes.map((n) => <li key={n}>{n}</li>)}</ul><button className="btn ghost" onClick={() => setStep("check")}>Change my answers</button></div>
      <form className="card" action={action}>
        <h2>Get early access</h2>
        <p className="muted">Join the waitlist and we'll send your personal J-1 roadmap when early access opens. Three quick questions help us build the right thing.</p>
        {(["residence", "english", "field"] as const).map((k) => <input key={k} type="hidden" name={k === "english" ? "english" : k} value={a[k]} />)}
        <input type="hidden" name="applicant_status" value={a.status} /><input type="hidden" name="duration_months" value={months} /><input type="hidden" name="fit_result" value={fit.category} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
        <label>Have you found a host company?<select name="host_state" defaultValue="none"><option value="none">Not yet, not started</option><option value="searching">Searching</option><option value="have">Yes</option></select></label>
        <label>Have you chosen a sponsor?<select name="sponsor_state" defaultValue="none"><option value="none">No, not started</option><option value="researching">Researching</option><option value="have">Yes</option></select></label>
        <label>What would you realistically pay per month for a tool that guides you through all this?<select name="willing_to_pay" defaultValue="up_to_10"><option value="free_only">Nothing, I'd only use free tools</option><option value="up_to_10">Up to $10</option><option value="10_to_20">$10 to $20</option><option value="20_to_40">$20 to $40</option><option value="over_40">More than $40</option></select></label>
        <label>Email<input type="email" name="email" required autoComplete="email" placeholder="you@example.com" /></label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" name="consent" required style={{ width: 20, minHeight: 20, marginTop: 2 }} /><span className="muted">I agree to be emailed about PathWise early access. I can unsubscribe any time.</span></label>
        {state && !state.ok && <p role="alert" style={{ color: "#8A3417" }}>{state.error}</p>}
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Join the waitlist"}</button>
      </form>
    </div>
  );
}
