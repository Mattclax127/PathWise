"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal("on"),
  fit_result: z.enum(["intern", "trainee", "unsure"]),
  residence: z.enum(["outside_us", "in_us"]),
  applicant_status: z.enum(["student", "recent_grad", "grad_experience", "experience_only", "other"]),
  english: z.enum(["good", "limited"]),
  duration_months: z.coerce.number().int().min(1).max(24),
  field: z.enum(["hospitality", "other"]),
  host_state: z.enum(["none", "searching", "have"]),
  sponsor_state: z.enum(["none", "researching", "have"]),
  willing_to_pay: z.enum(["free_only", "up_to_10", "10_to_20", "20_to_40", "over_40"]),
});
export interface JoinResult { ok: boolean; error?: string; already?: boolean }

export async function joinWaitlist(_prev: JoinResult | null, form: FormData): Promise<JoinResult> {
  if (String(form.get("website") ?? "") !== "") return { ok: true }; // honeypot: bots fill the hidden field, so pretend it worked
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please check your email and answer every question." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_signups").insert({
    email: d.email, consent: true, fit_result: d.fit_result, residence: d.residence, applicant_status: d.applicant_status, english: d.english,
    duration_months: d.duration_months, field: d.field, host_state: d.host_state, sponsor_state: d.sponsor_state, willing_to_pay: d.willing_to_pay,
    source: String(form.get("source") ?? "").slice(0, 60) || null,
  });
  if (error?.code === "23505") return { ok: true, already: true };
  if (error) return { ok: false, error: "Something went wrong saving that. Please try again in a moment." };
  return { ok: true };
}
