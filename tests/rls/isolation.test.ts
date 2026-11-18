// Integration test against a REAL Supabase project or `supabase start` (never production).
// It creates two throwaway users with the secret key, then checks everything as each user with the publishable key.
import "dotenv/config";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { progressPercent } from "@/lib/journey/progress";
import type { JourneyTask } from "@/lib/journey/types";

dotenv.config({ path: ".env.test" });
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY } = process.env;
const ready = !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SECRET_KEY);

const answers = (over: Record<string, unknown> = {}) => ({
  country_of_residence: "France", citizenship: "France", education_status: "recent_graduate", experience_level: "under_1_year",
  career_field: "marketing", program_category: "intern", destination_city: "Miami", duration_months: 6, budget_range: "8000_to_12000",
  has_host: false, has_agency_quote: false, ...over,
});

describe.skipIf(!ready)("account isolation and task rules", () => {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const stamp = Date.now();
  const creds = { a: { email: `pw-a-${stamp}@example.test`, password: "test-password-A-123" }, b: { email: `pw-b-${stamp}@example.test`, password: "test-password-B-123" } };
  const ids: Record<string, string> = {};
  let A: SupabaseClient, B: SupabaseClient;

  const signedIn = async (c: { email: string; password: string }) => {
    const client = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword(c);
    if (error) throw error;
    return client;
  };
  const tasksOf = async (client: SupabaseClient) => ((await client.from("journey_tasks").select("*").order("position")).data ?? []) as JourneyTask[];
  const byKey = (tasks: JourneyTask[], key: string) => tasks.find((t) => t.template_task_key === key)!;

  beforeAll(async () => {
    for (const k of ["a", "b"] as const) {
      const { data, error } = await admin.auth.admin.createUser({ ...creds[k], email_confirm: true });
      if (error) throw error;
      ids[k] = data.user.id;
    }
    A = await signedIn(creds.a); B = await signedIn(creds.b);
    expect((await A.from("questionnaire_responses").upsert({ user_id: ids.a, ...answers() }, { onConflict: "user_id" })).error).toBeNull();
    expect((await A.rpc("upsert_journey")).error).toBeNull();
    expect((await B.from("questionnaire_responses").upsert({ user_id: ids.b, ...answers({ destination_city: "Orlando" }) }, { onConflict: "user_id" })).error).toBeNull();
    expect((await B.rpc("upsert_journey")).error).toBeNull();
  });
  afterAll(async () => { for (const id of Object.values(ids)) await admin.auth.admin.deleteUser(id); });

  it("each user sees only their own questionnaire, journey, tasks, and events", async () => {
    for (const [client, own] of [[A, ids.a], [B, ids.b]] as const) {
      const q = await client.from("questionnaire_responses").select("user_id");
      expect(q.data?.every((r) => r.user_id === own)).toBe(true);
      const j = await client.from("journeys").select("user_id");
      expect(j.data).toHaveLength(1); expect(j.data![0].user_id).toBe(own);
      expect((await tasksOf(client)).length).toBeGreaterThan(0);
      expect((await client.from("journey_tasks").select("user_id")).data?.every((r) => r.user_id === own)).toBe(true);
    }
  });

  it("anonymous visitors see nothing", async () => {
    const anon = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    expect((await anon.from("journey_tasks").select("id")).data ?? []).toHaveLength(0);
    expect((await anon.from("questionnaire_responses").select("id")).data ?? []).toHaveLength(0);
  });

  it("user B cannot modify user A's tasks or answers", async () => {
    const aTask = byKey(await tasksOf(A), "define_target_roles");
    await B.from("journey_tasks").update({ status: "in_progress", notes: "hacked" }).eq("id", aTask.id);
    const { data } = await admin.from("journey_tasks").select("status,notes").eq("id", aTask.id).single();
    expect(data).toMatchObject({ status: "not_started", notes: "" });
    await B.from("questionnaire_responses").update({ citizenship: "Hacked" }).eq("user_id", ids.a);
    expect((await admin.from("questionnaire_responses").select("citizenship").eq("user_id", ids.a).single()).data?.citizenship).toBe("France");
  });

  it("users cannot insert, delete, or rewrite protected task fields", async () => {
    const mine = byKey(await tasksOf(A), "define_target_roles");
    const journeyId = (await A.from("journeys").select("id").single()).data!.id;
    expect((await A.from("journey_tasks").insert({ journey_id: journeyId, user_id: ids.a, template_task_key: "x", section: "employer_journey", title: "x", position: 99 })).error).not.toBeNull();
    expect((await A.from("journey_tasks").update({ title: "renamed" }).eq("id", mine.id)).error).not.toBeNull();
    expect((await A.from("journey_tasks").update({ external_verification: false }).eq("id", byKey(await tasksOf(A), "sponsor_accepts_application").id)).error).not.toBeNull();
    await A.from("journey_tasks").delete().eq("id", mine.id);
    expect(byKey(await tasksOf(A), "define_target_roles")).toBeTruthy();
    expect((await B.from("journey_tasks").insert({ journey_id: journeyId, user_id: ids.a, template_task_key: "y", section: "employer_journey", title: "y", position: 98 })).error).not.toBeNull();
  });

  it("a user cannot self-verify sponsor approval or skip evidence and dependencies", async () => {
    const t = await tasksOf(A);
    const sponsorOk = await A.from("journey_tasks").update({ status: "completed" }).eq("id", byKey(t, "sponsor_accepts_application").id);
    expect(sponsorOk.error?.message).toMatch(/third party|Complete these steps first/);
    const external = await A.from("journey_tasks").update({ status: "completed" }).eq("id", byKey(t, "confirm_category_with_sponsor").id);
    expect(external.error?.message).toMatch(/third party|Complete these steps first/);
    const noEvidence = await A.from("journey_tasks").update({ status: "completed" }).eq("id", byKey(t, "check_self_placement_policy").id);
    expect(noEvidence.error).not.toBeNull();
    const awaiting = await A.from("journey_tasks").update({ status: "awaiting_external_confirmation" }).eq("id", byKey(t, "confirm_category_with_sponsor").id);
    expect(awaiting.error).toBeNull();
  });

  it("completing tasks changes real progress and logs activity", async () => {
    const before = progressPercent(await tasksOf(A));
    const t = byKey(await tasksOf(A), "define_target_roles");
    expect((await A.from("journey_tasks").update({ status: "completed" }).eq("id", t.id)).error).toBeNull();
    const after = await tasksOf(A);
    expect(progressPercent(after)).toBeGreaterThan(before);
    expect(byKey(after, "define_target_roles").completed_at).not.toBeNull();
    expect(progressPercent(await tasksOf(B))).toBe(before); // B is unaffected
    expect((await A.from("activity_events").select("event_type").eq("event_type", "task_status_changed")).data?.length).toBeGreaterThan(0);
  });

  it("changing answers adapts the roadmap without deleting progress", async () => {
    expect((await A.from("questionnaire_responses").update({ has_host: true }).eq("user_id", ids.a)).error).toBeNull();
    expect((await A.rpc("upsert_journey")).error).toBeNull();
    const t = await tasksOf(A);
    expect(byKey(t, "shortlist_employers").is_applicable).toBe(false);
    expect(byKey(t, "record_host_details").is_applicable).toBe(true);
    expect(byKey(t, "define_target_roles").status).toBe("completed");
  });
});
