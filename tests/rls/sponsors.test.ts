// Integration test (real Supabase project or `supabase start`, never production). Needs .env.test like isolation.test.ts.
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

dotenv.config({ path: ".env.test" });
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY } = process.env;
const ready = !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SECRET_KEY);

const answers = { country_of_residence: "France", citizenship: "France", education_status: "recent_graduate", experience_level: "none", career_field: "marketing",
  program_category: "intern", destination_city: "Miami", duration_months: 6, budget_range: "8000_to_12000", has_host: false, has_agency_quote: false };

describe.skipIf(!ready)("sponsor data and saved sponsors", () => {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const stamp = Date.now();
  const creds = { a: { email: `sp-a-${stamp}@example.test`, password: "test-password-A-123" }, b: { email: `sp-b-${stamp}@example.test`, password: "test-password-B-123" } };
  const ids: Record<string, string> = {};
  const slugs = { pub: `test-pub-${stamp}`, draft: `test-draft-${stamp}` };
  let sponsorPub = "", sponsorDraft = "", A: SupabaseClient, B: SupabaseClient;
  const anon = () => createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const signIn = async (c: { email: string; password: string }) => { const cl = anon(); const { error } = await cl.auth.signInWithPassword(c); if (error) throw error; return cl; };
  const optionsOf = async (c: SupabaseClient) => (await c.from("journey_sponsor_options").select("sponsor_id,status")).data ?? [];

  beforeAll(async () => {
    const mk = async (slug: string, published: boolean, status: string) => {
      const { data, error } = await admin.from("sponsors").insert({ slug, name: slug, record_status: status, is_published: published, designation_verified_at: "2026-11-13", is_sample: true }).select("id").single();
      if (error) throw error; return data.id as string;
    };
    sponsorPub = await mk(slugs.pub, true, "verified"); sponsorDraft = await mk(slugs.draft, false, "needs_review");
    for (const k of ["a", "b"] as const) { const { data, error } = await admin.auth.admin.createUser({ ...creds[k], email_confirm: true }); if (error) throw error; ids[k] = data.user.id; }
    A = await signIn(creds.a); B = await signIn(creds.b);
    for (const [c, u] of [[A, ids.a], [B, ids.b]] as const) {
      expect((await c.from("questionnaire_responses").upsert({ user_id: u, ...answers }, { onConflict: "user_id" })).error).toBeNull();
      expect((await c.rpc("upsert_journey")).error).toBeNull();
    }
  });
  afterAll(async () => {
    for (const id of Object.values(ids)) await admin.auth.admin.deleteUser(id);
    await admin.from("sponsors").delete().in("slug", Object.values(slugs));
  });

  it("anyone can read published, verified sponsors but not drafts", async () => {
    const rows = (await anon().from("sponsors").select("id,slug")).data ?? [];
    expect(rows.some((r) => r.id === sponsorPub)).toBe(true);
    expect(rows.some((r) => r.id === sponsorDraft)).toBe(false);
    expect(((await A.from("sponsors").select("id").eq("id", sponsorDraft)).data ?? [])).toHaveLength(0);
  });

  it("nobody can modify sponsor data or fees with the browser keys", async () => {
    for (const c of [anon(), A]) {
      expect((await c.from("sponsors").insert({ slug: `x-${stamp}`, name: "x" })).error).not.toBeNull();
      await c.from("sponsors").update({ name: "hacked" }).eq("id", sponsorPub);
      await c.from("sponsors").delete().eq("id", sponsorPub);
      expect((await c.from("government_fees").insert({ key: `k-${stamp}`, label: "x", source_url: "x", verified_at: "2026-11-13" })).error).not.toBeNull();
      expect((await c.from("sponsor_fee_schedules").insert({ sponsor_id: sponsorPub })).error).not.toBeNull();
    }
    expect((await admin.from("sponsors").select("name").eq("id", sponsorPub).single()).data?.name).toBe(slugs.pub);
  });

  it("users can save, change, and remove sponsors, and it persists across a fresh login", async () => {
    expect((await A.from("journey_sponsor_options").insert({ journey_id: (await A.from("journeys").select("id").single()).data!.id, user_id: ids.a, sponsor_id: sponsorPub, status: "saved" })).error).toBeNull();
    const again = await signIn(creds.a);
    expect(await optionsOf(again)).toEqual([{ sponsor_id: sponsorPub, status: "saved" }]);
    expect((await again.from("journey_sponsor_options").update({ status: "shortlisted" }).eq("sponsor_id", sponsorPub)).error).toBeNull();
    expect((await optionsOf(again))[0].status).toBe("shortlisted");
    expect((await again.from("journey_sponsor_options").delete().eq("sponsor_id", sponsorPub)).error).toBeNull();
    expect(await optionsOf(again)).toHaveLength(0);
  });

  it("upsert() is denied by the column-level grant, which is why the app uses update-then-insert", async () => {
    const jA = (await A.from("journeys").select("id").single()).data!.id;
    const r = await A.from("journey_sponsor_options").upsert({ journey_id: jA, user_id: ids.a, sponsor_id: sponsorPub, status: "saved" }, { onConflict: "journey_id,sponsor_id" });
    expect(r.error).not.toBeNull();
  });

  it("users cannot save an unpublished sponsor or write rows for someone else", async () => {
    const jA = (await A.from("journeys").select("id").single()).data!.id;
    expect((await A.from("journey_sponsor_options").insert({ journey_id: jA, user_id: ids.a, sponsor_id: sponsorDraft, status: "saved" })).error).not.toBeNull();
    expect((await B.from("journey_sponsor_options").insert({ journey_id: jA, user_id: ids.a, sponsor_id: sponsorPub, status: "saved" })).error).not.toBeNull();
    expect((await B.from("journey_sponsor_options").insert({ journey_id: jA, user_id: ids.b, sponsor_id: sponsorPub, status: "saved" })).error).not.toBeNull();
  });

  it("users cannot see or change each other's saved sponsors", async () => {
    expect((await A.rpc("set_preferred_sponsor", { p_sponsor_id: sponsorPub })).error).toBeNull();
    expect(await optionsOf(B)).toHaveLength(0);
    await B.from("journey_sponsor_options").update({ status: "saved" }).eq("sponsor_id", sponsorPub);
    await B.from("journey_sponsor_options").delete().eq("sponsor_id", sponsorPub);
    expect(await optionsOf(A)).toEqual([{ sponsor_id: sponsorPub, status: "preferred" }]);
  });

  it("choosing a preferred sponsor starts the task but never completes approval steps", async () => {
    const { data } = await A.from("journey_tasks").select("template_task_key,status");
    const status = (k: string) => data!.find((t) => t.template_task_key === k)!.status;
    expect(status("select_sponsor")).toBe("in_progress");
    expect(status("sponsor_accepts_application")).toBe("not_started");
    expect(status("sponsor_issues_documents")).toBe("not_started");
    expect(((await B.from("journey_tasks").select("status").eq("template_task_key", "select_sponsor")).data ?? [])[0].status).toBe("not_started");
  });

  it("a second preferred sponsor demotes the first (one preferred per journey)", async () => {
    const { data: other } = await admin.from("sponsors").insert({ slug: `test-pub2-${stamp}`, name: "two", record_status: "verified", is_published: true, designation_verified_at: "2026-11-13", is_sample: true }).select("id").single();
    expect((await A.rpc("set_preferred_sponsor", { p_sponsor_id: other!.id })).error).toBeNull();
    const opts = await optionsOf(A);
    expect(opts.filter((o) => o.status === "preferred")).toEqual([{ sponsor_id: other!.id, status: "preferred" }]);
    expect(opts.find((o) => o.sponsor_id === sponsorPub)?.status).toBe("shortlisted");
    await admin.from("sponsors").delete().eq("id", other!.id);
  });
});
