"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MAX_RESUME_BYTES, builtResumeSchema, resumeMime, safeFileName, validateResumeFile } from "@/lib/engine/resume";

export interface Result { ok: boolean; error?: string }
const id = z.string().uuid("Invalid item.");
const STATUSES = ["saved", "preparing", "submitted", "responded", "interview", "offer_received", "declined", "withdrawn"] as const;
const NEEDS_EVIDENCE: readonly string[] = ["submitted", "responded", "interview", "offer_received"];
const refresh = () => { revalidatePath("/journey"); revalidatePath("/journey/employer"); revalidatePath("/dashboard"); };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: journey } = await supabase.from("journeys").select("id").maybeSingle();
  return journey ? { supabase, user, journeyId: journey.id as string } : null;
}
const NOT_READY: Result = { ok: false, error: "Sign in and finish onboarding first." };

export async function saveOpportunity(opportunityId: string): Promise<Result> {
  if (!id.safeParse(opportunityId).success) return { ok: false, error: "Invalid listing." };
  const c = await ctx(); if (!c) return NOT_READY;
  const { error } = await c.supabase.from("employer_applications").insert({ user_id: c.user.id, journey_id: c.journeyId, opportunity_id: opportunityId });
  if (error && !/duplicate/i.test(error.message)) return { ok: false, error: error.message };
  refresh(); return { ok: true };
}

export async function dismissOpportunity(opportunityId: string): Promise<Result> {
  if (!id.safeParse(opportunityId).success) return { ok: false, error: "Invalid listing." };
  const c = await ctx(); if (!c) return NOT_READY;
  const { error } = await c.supabase.from("opportunity_dismissals").insert({ user_id: c.user.id, opportunity_id: opportunityId });
  if (error && !/duplicate/i.test(error.message)) return { ok: false, error: error.message };
  return { ok: true };
}

export async function undoDismiss(opportunityId: string): Promise<Result> {
  if (!id.safeParse(opportunityId).success) return { ok: false, error: "Invalid listing." };
  const c = await ctx(); if (!c) return NOT_READY;
  const { error } = await c.supabase.from("opportunity_dismissals").delete().eq("opportunity_id", opportunityId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

const appSchema = z.object({ applicationId: id, status: z.enum(STATUSES), notes: z.string().max(2000), evidenceNote: z.string().max(2000) });
export async function updateApplication(input: z.input<typeof appSchema>): Promise<Result> {
  const p = appSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid input." };
  if (NEEDS_EVIDENCE.includes(p.data.status) && p.data.evidenceNote.trim() === "")
    return { ok: false, error: "Add evidence first: a link, the email subject and date, or a reference. This keeps your record honest." };
  const c = await ctx(); if (!c) return NOT_READY;
  const { data, error } = await c.supabase.from("employer_applications")
    .update({ status: p.data.status, notes: p.data.notes, evidence_note: p.data.evidenceNote.trim() }).eq("id", p.data.applicationId).select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Application not found." };
  refresh(); return { ok: true };
}

export async function removeSavedApplication(applicationId: string): Promise<Result> {
  if (!id.safeParse(applicationId).success) return { ok: false, error: "Invalid item." };
  const c = await ctx(); if (!c) return NOT_READY;
  const { error } = await c.supabase.from("employer_applications").delete().eq("id", applicationId).eq("status", "saved");
  if (error) return { ok: false, error: error.message };
  refresh(); return { ok: true };
}

async function setChoice(c: NonNullable<Awaited<ReturnType<typeof ctx>>>, choice: "uploaded" | "built" | "skipped") {
  const { data } = await c.supabase.from("journey_state").update({ resume_choice: choice }).eq("journey_id", c.journeyId).select("journey_id");
  if (!data?.length) await c.supabase.from("journey_state").insert({ journey_id: c.journeyId, user_id: c.user.id, resume_choice: choice });
}

export async function skipResume(): Promise<Result> {
  const c = await ctx(); if (!c) return NOT_READY;
  await setChoice(c, "skipped"); refresh(); return { ok: true };
}

export async function uploadResume(form: FormData): Promise<Result> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a PDF or DOCX file." };
  if (file.size > MAX_RESUME_BYTES) return { ok: false, error: "Keep the file under 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bad = validateResumeFile(file.name, bytes);
  if (bad) return { ok: false, error: bad };
  const c = await ctx(); if (!c) return NOT_READY;
  const path = `${c.user.id}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: uerr } = await c.supabase.storage.from("resumes").upload(path, bytes, { contentType: resumeMime(file.name), upsert: false });
  if (uerr) return { ok: false, error: `Upload failed: ${uerr.message}` };
  const { data: existing } = await c.supabase.from("resumes").select("id, file_path").maybeSingle();
  const row = { kind: "uploaded" as const, file_path: path, file_name: safeFileName(file.name), built_data: null };
  const { error } = existing
    ? await c.supabase.from("resumes").update(row).eq("id", existing.id)
    : await c.supabase.from("resumes").insert({ user_id: c.user.id, ...row });
  if (error) return { ok: false, error: error.message };
  if (existing?.file_path && existing.file_path !== path) await c.supabase.storage.from("resumes").remove([existing.file_path]);
  await setChoice(c, "uploaded"); refresh(); return { ok: true };
}

export async function buildResume(input: z.input<typeof builtResumeSchema>): Promise<Result> {
  const p = builtResumeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check your details." };
  const c = await ctx(); if (!c) return NOT_READY;
  const { data: existing } = await c.supabase.from("resumes").select("id").maybeSingle();
  const row = { kind: "built" as const, file_path: null, file_name: null, built_data: p.data };
  const { error } = existing
    ? await c.supabase.from("resumes").update(row).eq("id", existing.id)
    : await c.supabase.from("resumes").insert({ user_id: c.user.id, ...row });
  if (error) return { ok: false, error: error.message };
  await setChoice(c, "built"); refresh(); return { ok: true };
}
