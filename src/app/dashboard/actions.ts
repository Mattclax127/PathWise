"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TASK_STATUSES } from "@/lib/journey/types";

const schema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
  notes: z.string().max(2000, "Notes can be up to 2,000 characters."),
  evidenceNote: z.string().max(2000, "Evidence can be up to 2,000 characters."),
});

export async function updateTask(input: z.input<typeof schema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  // RLS limits this to the caller's own rows; database triggers enforce dependency, evidence, and third-party rules.
  const { data, error } = await supabase.from("journey_tasks")
    .update({ status: parsed.data.status, notes: parsed.data.notes, evidence_note: parsed.data.evidenceNote })
    .eq("id", parsed.data.taskId).select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Task not found." };
  revalidatePath("/dashboard");
  revalidatePath("/journey");
  return { ok: true };
}
