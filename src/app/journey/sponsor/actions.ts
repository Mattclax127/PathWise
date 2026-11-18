"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const FACT_TYPES = ["confirm_category_with_sponsor", "sponsor_accepts_application", "sponsor_reviews_host", "sponsor_issues_documents", "visa_decision"] as const;
const schema = z.object({
  factType: z.enum(FACT_TYPES, { error: "Choose what you want to record." }),
  evidenceNote: z.string().trim().min(3, "Add the evidence: an email subject and date, a reference number, or a link.").max(2000, "Keep this under 2,000 characters."),
});

/** Records a CLAIM. It moves the step to "awaiting confirmation". Nothing becomes confirmed from the browser. */
export async function claimExternalFact(input: z.input<typeof schema>): Promise<{ ok: boolean; error?: string }> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid input." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const { data: journey } = await supabase.from("journeys").select("id").maybeSingle();
  if (!journey) return { ok: false, error: "Finish onboarding first." };
  const { error } = await supabase.from("external_facts").insert({ user_id: user.id, journey_id: journey.id, fact_type: p.data.factType, evidence_note: p.data.evidenceNote });
  if (error) return { ok: false, error: /duplicate/i.test(error.message) ? "You already recorded this. It is awaiting confirmation." : error.message };
  revalidatePath("/journey"); revalidatePath("/journey/sponsor"); revalidatePath("/dashboard");
  return { ok: true };
}
