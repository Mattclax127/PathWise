"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/auth-actions";

interface Props {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  showEmail?: boolean;
  passwordLabel?: string | null;
  hidden?: Record<string, string>;
}
export default function AuthForm({ action, submitLabel, showEmail = true, passwordLabel = "Password", hidden = {} }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} noValidate>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {showEmail && (<div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>)}
      {passwordLabel && (<div className="field"><label htmlFor="password">{passwordLabel}</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>)}
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.message && <p className="ok-msg" role="status">{state.message}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Working..." : submitLabel}</button>
    </form>
  );
}
