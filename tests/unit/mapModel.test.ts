import { describe, it, expect } from "vitest";
import { buildMapModel, STAGE_DEFS } from "@/lib/map/mapModel";
import { STAGE_F, pointAt, ROAD_SAMPLES } from "@/lib/map/roadGeometry";
import type { JourneyTask, TaskStatus } from "@/lib/journey/types";

const official = new Set(["confirm_category_with_sponsor", "sponsor_reviews_host", "sponsor_accepts_application", "sponsor_issues_documents", "visa_decision", "confirm_arrival"]);
const KEYS = STAGE_DEFS.flatMap((d) => [...d.checkpoints, ...d.gate]);
const sectionOf = (k: string) => STAGE_DEFS.find((d) => d.checkpoints.includes(k) || d.gate.includes(k))!.section;

function tasks(over: Record<string, Partial<JourneyTask> | "missing"> = {}): JourneyTask[] {
  return KEYS.flatMap((k, i) => {
    if (over[k] === "missing") return [];
    return [{
      id: `t${i}`, template_task_key: k, section: sectionOf(k) as JourneyTask["section"], title: k, description: "", position: i,
      status: "not_started" as TaskStatus, requires_evidence: false, external_verification: official.has(k), is_applicable: true,
      depends_on: [], notes: "", evidence_note: "", completed_at: null, ...(over[k] as Partial<JourneyTask> | undefined),
    }];
  });
}
const done = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, { status: "completed" as TaskStatus }]));

describe("road geometry", () => {
  it("has the six stages in order along the road, start at 0 and finish at 1", () => {
    expect(STAGE_F).toHaveLength(6);
    expect(STAGE_F[0]).toBe(0);
    expect(STAGE_F[5]).toBe(1);
    for (let i = 1; i < 6; i++) expect(STAGE_F[i]).toBeGreaterThan(STAGE_F[i - 1]);
  });
  it("starts and ends at the blueprint road ends", () => {
    expect(pointAt(0).x).toBeCloseTo(145, 0);
    expect(pointAt(0).y).toBeCloseTo(740, 0);
    expect(pointAt(1).x).toBeCloseTo(1450, 0);
    expect(pointAt(1).y).toBeCloseTo(200, 0);
    expect(ROAD_SAMPLES.length).toBeGreaterThan(400);
  });
});

describe("map model", () => {
  it("starts at the start line with nothing done", () => {
    const m = buildMapModel(tasks());
    expect(m.characterIndex).toBe(-1);
    expect(m.characterF).toBe(0);
    expect(m.nodes[0].status).toBe("next");
    expect(m.finished).toBe(false);
  });
  it("keeps the six stages in order and the road in increasing order", () => {
    const m = buildMapModel(tasks());
    expect(m.stages.map((s) => s.name)).toEqual(STAGE_DEFS.map((d) => d.name));
    for (let i = 1; i < m.nodes.length; i++) expect(m.nodes[i].f).toBeGreaterThan(m.nodes[i - 1].f);
  });
  it("moves the character to the end of the unbroken run of finished nodes", () => {
    const m = buildMapModel(tasks(done("complete_questionnaire", "prepare_cv", "save_first_opportunity")));
    expect(m.nodes[m.characterIndex].taskKey).toBe("save_first_opportunity");
    const next = m.nodes.find((n) => n.status === "next")!;
    expect(next.taskKey).toBe("submit_first_application");
  });
  it("does not run ahead when work finishes out of order (employer and sponsor are parallel)", () => {
    const m = buildMapModel(tasks(done("complete_questionnaire", "shortlist_sponsors")));
    const sp = m.nodes.find((n) => n.taskKey === "shortlist_sponsors")!;
    expect(sp.status).toBe("done");
    expect(m.nodes[m.characterIndex].id).toBe("profile_eligibility:stage");
    expect(m.characterF).toBe(0);
  });
  it("shows an official gate as confirmed only when completed, waiting while awaited", () => {
    const waiting = buildMapModel(tasks({ sponsor_accepts_application: { status: "awaiting_external_confirmation" } }));
    expect(waiting.nodes.find((n) => n.taskKey === "sponsor_accepts_application")!.status).toBe("waiting");
    const claimed = buildMapModel(tasks({ sponsor_accepts_application: { status: "in_progress" } }));
    expect(claimed.nodes.find((n) => n.taskKey === "sponsor_accepts_application")!.status).not.toBe("confirmed");
    const ok = buildMapModel(tasks({ sponsor_accepts_application: { status: "completed" } }));
    expect(ok.nodes.find((n) => n.taskKey === "sponsor_accepts_application")!.status).toBe("confirmed");
  });
  it("leaves tasks that do not apply off the road and invents none", () => {
    const base = buildMapModel(tasks()).nodes.length;
    const m = buildMapModel(tasks({ shortlist_sponsors: { is_applicable: false }, choose_preferred_sponsor: { is_applicable: false } }));
    expect(m.nodes.length).toBe(base - 2);
    expect(m.nodes.some((n) => n.taskKey === "shortlist_sponsors")).toBe(false);
  });
  it("tolerates journeys created before newer template tasks existed", () => {
    const m = buildMapModel(tasks({ shortlist_sponsors: "missing", save_first_opportunity: "missing", sponsor_reviews_host: "missing" }));
    expect(m.stages).toHaveLength(6);
  });
  it("marks the arrival stage pending, and never finished, when its confirmation task does not exist", () => {
    const m = buildMapModel(tasks({ confirm_arrival: "missing" }));
    const arrival = m.nodes[m.nodes.length - 1];
    expect(arrival.pending).toBe(true);
    expect(arrival.status).not.toBe("done");
    expect(m.finished).toBe(false);
  });
  it("celebrates only when the applicant confirms arrival", () => {
    const all = KEYS.filter((k) => k !== "confirm_arrival");
    const before = buildMapModel(tasks(done(...all)));
    expect(before.finished).toBe(false);
    const after = buildMapModel(tasks(done(...KEYS)));
    expect(after.finished).toBe(true);
    expect(after.characterF).toBe(1);
  });
});
