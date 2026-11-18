"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { buildResume, skipResume, uploadResume } from "@/app/journey/employer/actions";

/** Shown until the applicant makes a choice. The choice is saved in the database, so it never reappears. */
export default function ResumeSetup() {
  const [mode, setMode] = useState<"choose" | "upload" | "build">("choose");
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, [mode]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, []);
  if (!open) return null;
  const done = (r: { ok: boolean; error?: string }) => { if (r.ok) setOpen(false); else setError(r.error ?? "Something went wrong."); };
  return (
    <div className="modal-back" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="resume-h">
        <h2 id="resume-h" ref={ref} tabIndex={-1} style={{ fontSize: 22 }}>Set up your résumé</h2>
        <p className="muted">Employers expect one. You can upload a file, build a simple one here, or skip for now. We will not ask again after you choose.</p>
        {mode === "choose" && (<div style={{ display: "grid", gap: 8 }}>
          <button className="btn" type="button" onClick={() => setMode("upload")}>Upload a PDF or DOCX</button>
          <button className="btn ghost" type="button" onClick={() => setMode("build")}>Build one in PathWise</button>
          <button className="btn ghost" type="button" disabled={pending} onClick={() => run(async () => done(await skipResume()))}>Skip for now</button>
        </div>)}
        {mode === "upload" && (
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setError(null); run(async () => done(await uploadResume(fd))); }}>
            <label htmlFor="resume-file">PDF or DOCX, up to 5 MB</label>
            <input id="resume-file" name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
            <p className="muted" style={{ fontSize: 13 }}>Stored privately; only you can open it. Do not upload passports or ID documents.</p>
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn" type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>{" "}
            <button className="btn ghost" type="button" onClick={() => { setMode("choose"); setError(null); }}>Back</button>
          </form>)}
        {mode === "build" && (
          <form onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; setError(null);
            run(async () => done(await buildResume({ headline: f.headline, summary: f.summary, education: f.education, experience: f.experience, skills: f.skills }))); }}>
            <div className="field"><label htmlFor="b1">Headline</label><input id="b1" name="headline" maxLength={120} required placeholder="Marketing graduate seeking a 6-month internship" /></div>
            <div className="field"><label htmlFor="b2">Summary</label><textarea id="b2" name="summary" rows={2} maxLength={600} /></div>
            <div className="field"><label htmlFor="b3">Education</label><textarea id="b3" name="education" rows={2} maxLength={800} required /></div>
            <div className="field"><label htmlFor="b4">Experience (use only real experience)</label><textarea id="b4" name="experience" rows={3} maxLength={2000} /></div>
            <div className="field"><label htmlFor="b5">Skills</label><textarea id="b5" name="skills" rows={2} maxLength={600} /></div>
            {error && <p className="err" role="alert">{error}</p>}
            <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save résumé"}</button>{" "}
            <button className="btn ghost" type="button" onClick={() => { setMode("choose"); setError(null); }}>Back</button>
          </form>)}
      </div>
    </div>
  );
}
