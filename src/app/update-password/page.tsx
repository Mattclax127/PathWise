import AuthForm from "@/components/AuthForm";
import { updatePassword } from "../auth-actions";
export default function UpdatePassword() {
  return (
    <div className="narrow"><h1>Choose a new password</h1>
      <div className="card"><AuthForm action={updatePassword} submitLabel="Save password" showEmail={false} passwordLabel="New password" /></div></div>
  );
}
