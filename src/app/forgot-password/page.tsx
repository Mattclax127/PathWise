import AuthForm from "@/components/AuthForm";
import { requestPasswordReset } from "../auth-actions";
export default function Forgot() {
  return (
    <div className="narrow"><h1>Reset your password</h1><p className="muted">We will email you a reset link.</p>
      <div className="card"><AuthForm action={requestPasswordReset} submitLabel="Send reset link" passwordLabel={null} /></div></div>
  );
}
