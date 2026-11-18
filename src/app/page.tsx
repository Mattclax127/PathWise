import Link from "next/link";
export default function Home() {
  return (
    <div className="narrow" style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: 40, fontWeight: 800 }}>Your U.S. journey. Your way.</h1>
      <p className="muted" style={{ fontSize: 18, lineHeight: 1.6 }}>Answer a few questions and get a personalized J-1 roadmap you can track.</p>
      <p style={{ marginTop: 20 }}><Link className="btn" href="/signup">Build my free plan</Link></p>
      <p className="muted" style={{ fontSize: 13 }}>The full landing page from the design prototype will be ported here later.</p>
    </div>
  );
}
