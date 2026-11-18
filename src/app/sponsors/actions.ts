"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ sponsorId: z.string().uuid(), status: z.enum(["saved", "shortlisted", "preferred"]) });
type Result = { ok: boolean; error?: string };

export async function saveSponsorOption(input: z.input<typeof schema>): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid sponsor." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to save sponsors." };
  const { sponsorId, status } = parsed.data;

  if (status === "preferred") {
    // One transaction in the database: demotes the old preferred sponsor and sets the new one.
    const { error } = await supabase.rpc("set_preferred_sponsor", { p_sponsor_id: sponsorId });
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: journey } = await supabase.from("journeys").select("id").maybeSingle();
    if (!journey) return { ok: false, error: "Finish the questionnaire to create your journey first." };
    // Not upsert(): users only hold UPDATE on (status, notes), and an upsert would also SET journey_id/user_id/sponsor_id.
    const { data: updated, error: uerr } = await supabase.from("journey_sponsor_options").update({ status }).eq("sponsor_id", sponsorId).select("id");
    if (uerr) return { ok: false, error: uerr.message };
    if (!updated?.length) {
      const { error } = await supabase.from("journey_sponsor_options").insert({ journey_id: journey.id, user_id: user.id, sponsor_id: sponsorId, status });
      if (error) return { ok: false, error: error.message };
    }
  }
  revalidatePath("/dashboard");
  revalidatePath("/sponsors");
  return { ok: true };
}

export async function removeSponsorOption(sponsorId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(sponsorId).success) return { ok: false, error: "Invalid sponsor." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in first." };
  const { error } = await supabase.from("journey_sponsor_options").delete().eq("sponsor_id", sponsorId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/sponsors");
  return { ok: true };
}
