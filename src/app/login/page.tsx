import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signIn } from "../auth-actions";
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/dashboard", error } = await searchParams;
  return (
    <div className="narrow"><h1>Log in</h1>
      {error === "link" && <p className="err">That email link is invalid or expired. Request a new one.</p>}
      <div className="card" style={{ marginTop: 16 }}><AuthForm action={signIn} submitLabel="Log in" hidden={{ next }} /></div>
      <p className="muted"><Link href="/forgot-password">Forgot your password?</Link> · <Link href="/signup">Create an account</Link></p>
    </div>
  );
}
