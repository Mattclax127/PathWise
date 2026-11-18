"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toQuestionnaire, validateAnswer, type Answers } from "@/lib/engine/onboarding";

type Supa = Awaited<ReturnType<typeof createClient>>;
export interface StepResult { ok: boolean; error?: string }

/** The saved draft wins; otherwise start from the applicant's existing answers so nothing they saved is lost. */
export async function loadAnswers(supabase: Supa, userId: string): Promise<{ answers: Answers; stepKey: string | null; hasJourney: boolean }> {
  const { data: draft } = await supabase.from("onboarding_drafts").select("answers, step_key").eq("user_id", userId).maybeSingle();
  const { data: j } = await supabase.from("journeys").select("id").maybeSingle();
  if (draft) return { answers: draft.answers as Answers, stepKey: draft.step_key, hasJourney: !!j };
  const { data: q } = await supabase.from("questionnaire_responses").select("*").maybeSingle();
  if (!q) return { answers: {}, stepKey: null, hasJourney: !!j };
  const answers: Answers = {
    country_of_residence: q.country_of_residence, citizenship: q.citizenship, education_status: q.education_status, experience_level: q.experience_level,
    career_field: q.career_field, program_category: q.program_category, destination_city: q.destination_city, duration_months: String(q.duration_months),
    budget_range: q.budget_range, host_state: q.host_state, sponsor_state: q.sponsor_state, has_agency_quote: q.has_agency_quote ? "yes" : "no", service_level: q.service_level,
  };
  if (q.host_state === "offer") answers.host_evidence_note = q.host_evidence_note ?? "";
  return { answers, stepKey: null, hasJourney: !!j };
}

/** Autosaves one answer. Called on every Next, so closing the tab never loses progress. */
export async function saveAnswer(key: string, value: string, nextKey: string | null): Promise<StepResult> {
  const err = validateAnswer(key, value);
  if (err) return { ok: false, error: err };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const { answers } = await loadAnswers(supabase, user.id);
  const merged = { ...answers, [key]: value.trim() };
  const { error } = await supabase.from("onboarding_drafts").upsert({ user_id: user.id, answers: merged, step_key: nextKey }, { onConflict: "user_id" });
  if (error) return { ok: false, error: `Could not save: ${error.message}` };
  return { ok: true };
}

/** Saves the questionnaire, then builds or re-syncs the journey. Existing progress is kept by the database. */
export async function finishOnboarding(): Promise<StepResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const { answers } = await loadAnswers(supabase, user.id);
  const parsed = toQuestionnaire(answers);
  if (!parsed.success) return { ok: false, error: `Please finish every question (${parsed.error.issues[0]?.message ?? "something is missing"}).` };
  const { error } = await supabase.from("questionnaire_responses")
    .upsert({ user_id: user.id, ...parsed.data, completed_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: `Could not save your answers: ${error.message}` };
  const { error: jerr } = await supabase.rpc("upsert_journey");
  if (jerr) return { ok: false, error: `Your answers were saved, but the journey could not be built: ${jerr.message}` };
  revalidatePath("/journey"); revalidatePath("/dashboard");
  return { ok: true };
}
