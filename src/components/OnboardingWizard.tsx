"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishOnboarding, saveAnswer } from "@/app/questionnaire/actions";
import { STEPS, answerLabel, progressFraction, questionLabel, visibleSteps, type Answers } from "@/lib/engine/onboarding";

export default function OnboardingWizard({ initialAnswers, initialStep, hasJourney }: { initialAnswers: Answers; initialStep: string; hasJourney: boolean }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  const steps = visibleSteps(answers);
  const idx = steps.findIndex((s) => s.key === step);
  const current = idx >= 0 ? steps[idx] : null;
  const pct = Math.round(progressFraction(answers) * 100);
  const go = (key: string) => { setError(null); setStep(key); setTimeout(() => heading.current?.focus(), 0); };

  const next = (value: string) => {
    if (!current) return;
    const merged = { ...answers, [current.key]: value.trim() };
    const following = visibleSteps(merged)[visibleSteps(merged).findIndex((s) => s.key === current.key) + 1]?.key ?? "review";
    start(async () => {
      const r = await saveAnswer(current.key, value, following);
      if (!r.ok) return setError(r.error ?? "Could not save.");
      setAnswers(merged); go(following);
    });
  };
  const finish = () => {
    setBuilding(true);
    start(async () => {
      const r = await finishOnboarding();
      if (!r.ok) { setBuilding(false); return setError(r.error ?? "Could not build your journey."); }
      router.push("/journey"); router.refresh();
    });
  };

  if (building) return (
    <div className="card" role="status" aria-live="polite" style={{ textAlign: "center", padding: 40 }}>
      <h1 style={{ fontSize: 26 }}>Building your PathWise journey…</h1>
      <p className="muted">Setting up your employer and sponsor paths from your answers.</p>
    </div>
  );

  if (step === "review" || !current) return (
    <div className="card">
      <h1 ref={heading} tabIndex={-1} style={{ fontSize: 26 }}>{hasJourney ? "Your answers" : "Ready to build your journey?"}</h1>
      <p className="muted">This is a planning tool, not an eligibility decision. You can change any answer and your progress is kept.</p>
      <dl style={{ margin: "16px 0" }}>
        {steps.map((s) => (
          <div key={s.key} className="row" style={{ borderTop: "1px solid #EEF2FA", padding: "10px 0" }}>
            <div><dt className="muted" style={{ fontSize: 13 }}>{questionLabel(s.key)}</dt><dd style={{ margin: 0 }}>{answerLabel(s.key, answers[s.key] ?? "") || "Not answered"}</dd></div>
            <button className="btn ghost" type="button" onClick={() => go(s.key)}>Change</button>
          </div>
        ))}
      </dl>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" type="button" onClick={finish} disabled={pending}>{hasJourney ? "Save and update my journey" : "Build my journey"}</button>
    </div>
  );

  return (
    <div className="card">
      <div className="row"><span className="muted" style={{ fontSize: 13 }}>Question {idx + 1} of {steps.length}</span><span className="muted" style={{ fontSize: 13 }}>{pct}% answered, saved as you go</span></div>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding progress"><div style={{ width: `${pct}%` }} /></div>
      <h1 ref={heading} tabIndex={-1} style={{ fontSize: 26, margin: "20px 0 6px" }}>{current.title}</h1>
      {current.help && <p className="muted" style={{ marginTop: 0 }}>{current.help}</p>}
      <QuestionInput key={current.key} step={current} initial={answers[current.key] ?? ""} pending={pending} onNext={next} />
      {error && <p className="err" role="alert">{error}</p>}
      <div style={{ marginTop: 14 }}>
        {idx > 0 && <button className="btn ghost" type="button" onClick={() => go(steps[idx - 1].key)}>Back</button>}
        {" "}{answers[current.key] !== undefined && <button className="btn ghost" type="button" onClick={() => go("review")}>Review answers</button>}
      </div>
    </div>
  );
}

function QuestionInput({ step, initial, pending, onNext }: { step: (typeof STEPS)[number]; initial: string; pending: boolean; onNext: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  if (step.kind === "choice") return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Choose one</legend>
      {step.options!.map(([v, l]) => (
        <button key={v} type="button" className={`btn ${value === v ? "" : "ghost"}`} aria-pressed={value === v} disabled={pending}
          style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8 }} onClick={() => onNext(v)}>{l}</button>
      ))}
    </fieldset>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(value); }}>
      {step.kind === "longtext"
        ? <textarea aria-label={step.title} rows={3} value={value} maxLength={2000} onChange={(e) => setValue(e.target.value)} />
        : <input aria-label={step.title} value={value} maxLength={80} onChange={(e) => setValue(e.target.value)} autoComplete="off" />}
      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }}>{pending ? "Saving…" : "Next"}</button>
    </form>
  );
}
