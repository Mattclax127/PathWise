import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signUp } from "../auth-actions";
export default function Signup() {
  return (
    <div className="narrow"><h1>Create your account</h1>
      <p className="muted">Free to start. Use at least 10 characters for your password.</p>
      <div className="card"><AuthForm action={signUp} submitLabel="Create account" /></div>
      <p className="muted">Already have an account? <Link href="/login">Log in</Link></p>
    </div>
  );
}
