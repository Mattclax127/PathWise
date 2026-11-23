import type { Metadata } from "next";
import CheckForm from "./CheckForm";
export const metadata: Metadata = { title: "J-1 Intern or Trainee? Free quick check | PathWise", description: "Find out which J-1 path may fit you in under a minute. No account needed." };
export default function CheckPage() {
  return (
    <div className="narrow" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Which J-1 path may fit you?</h1>
      <p className="muted" style={{ marginBottom: 20 }}>A free self-check for the J-1 Intern and Trainee programs.</p>
      <CheckForm />
    </div>
  );
}
