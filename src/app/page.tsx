import Link from "next/link";

const STEPS = [
  { t: "Check where you fit", d: "A one-minute self-check shows whether the J-1 Intern or Trainee path may suit you, and flags common problems like program length." },
  { t: "See the whole process", d: "From finding a host company to the DS-2019, visa interview and arrival, in plain language and in the right order." },
  { t: "Compare before you pay", d: "Sponsor fees vary a lot. We are building a side-by-side comparison so you know the real cost before you commit." },
];
const FAQ = [
  ["Is PathWise a sponsor or an agency?", "No. Only a designated sponsor can issue the DS-2019. PathWise is an independent planning tool and will help you compare and connect with sponsors."],
  ["Do I need a sponsor even for a short or unpaid internship?", "Yes. Any J-1 internship or traineeship goes through a designated sponsor, whatever its length or pay."],
  ["Does PathWise guarantee a placement or a visa?", "No. We cannot approve anything. Employers, sponsors and the U.S. government make those decisions."],
  ["What does it cost?", "The quick check is free. We are still deciding early-access pricing, and the waitlist helps us get it right."],
];

export default function Home() {
  return (
    <div>
      <section className="hero"><div className="wrap">
        <h1>Plan your J-1 internship, step by step.</h1>
        <p className="lead">Find out which J-1 path may fit you, understand the process, and compare sponsors, before you pay anyone.</p>
        <p><Link className="btn big" href="/check">Take the free 1-minute check</Link></p>
        <p className="muted small">No account needed. Early access is opening soon.</p>
      </div></section>

      <section className="wrap sect">
        <h2>How PathWise helps</h2>
        <div className="grid3">{STEPS.map((s, i) => <div className="card" key={s.t}><span className="chip">Step {i + 1}</span><h3 style={{ margin: "10px 0 6px" }}>{s.t}</h3><p className="muted" style={{ margin: 0 }}>{s.d}</p></div>)}</div>
      </section>

      <section className="wrap sect">
        <h2>Honest about what we are</h2>
        <div className="card"><ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>We are not a J-1 sponsor, a placement agency or a law firm.</li>
          <li>We never submit applications or contact employers or sponsors for you.</li>
          <li>We show what is waiting on someone else, and never mark it done for you.</li>
        </ul></div>
      </section>

      <section className="wrap sect">
        <h2>Common questions</h2>
        {FAQ.map(([q, a]) => <details className="card" key={q}><summary style={{ fontWeight: 600, cursor: "pointer" }}>{q}</summary><p className="muted" style={{ marginBottom: 0 }}>{a}</p></details>)}
      </section>

      <section className="wrap sect" style={{ textAlign: "center" }}>
        <h2>Not sure where you stand?</h2>
        <p className="muted">It takes about a minute.</p>
        <p><Link className="btn big" href="/check">Take the free check</Link></p>
      </section>
    </div>
  );
}
