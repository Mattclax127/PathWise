import { describe, expect, it } from "vitest";
import { availability, displayStatus, focus, progressSummary, stageNodes, type StageMeta } from "@/lib/engine/engine";
import type { JourneyTask } from "@/lib/journey/types";

let n = 0;
const task = (o: Partial<JourneyTask> & { template_task_key: string }): JourneyTask => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`, section: "employer_journey", title: o.template_task_key, description: "",
  position: n, status: "not_started", requires_evidence: false, external_verification: false, is_applicable: true, depends_on: [],
  notes: "", evidence_note: "", completed_at: null, ...o,
});
const STAGES: StageMeta[] = [
  { section: "employer_journey", label: "Employer", branch: "employer", position: 2, map_x: 25, map_y: 30 },
  { section: "sponsor_journey", label: "Sponsor", branch: "sponsor", position: 2, map_x: 75, map_y: 30 },
];

describe("displayStatus", () => {
  it("never calls an official step plain 'completed'", () => {
    expect(displayStatus(task({ template_task_key: "a", status: "completed", external_verification: true }))).toBe("externally_confirmed");
    expect(displayStatus(task({ template_task_key: "b", status: "completed" }))).toBe("completed");
  });
  it("maps waiting and draft states and N/A", () => {
    expect(displayStatus(task({ template_task_key: "a", status: "awaiting_external_confirmation" }))).toBe("awaiting_response");
    expect(displayStatus(task({ template_task_key: "b", status: "ready_for_review" }))).toBe("draft_ready");
    expect(displayStatus(task({ template_task_key: "c", is_applicable: false, status: "completed" }))).toBe("not_applicable");
  });
});

describe("progressSummary", () => {
  it("keeps prepared work and official milestones separate and excludes N/A", () => {
    const t = [
      task({ template_task_key: "a", status: "completed" }), task({ template_task_key: "b" }), task({ template_task_key: "c", is_applicable: false }),
      task({ template_task_key: "o1", external_verification: true, status: "awaiting_external_confirmation" }),
      task({ template_task_key: "o2", external_verification: true, status: "completed" }),
    ];
    expect(progressSummary(t)).toEqual({ prepared: { done: 1, total: 2, percent: 50 }, official: { done: 1, total: 2, percent: 50 } });
  });
  it("reports 0 of 0 safely", () => expect(progressSummary([]).official).toEqual({ done: 0, total: 0, percent: 0 }));
  it("a prepared-everything journey shows 0 official milestones", () => {
    const t = [task({ template_task_key: "a", status: "completed" }), task({ template_task_key: "o", external_verification: true })];
    const s = progressSummary(t);
    expect(s.prepared.percent).toBe(100); expect(s.official.percent).toBe(0);
  });
});

describe("availability", () => {
  it("explains blocked steps instead of hiding them", () => {
    const a = task({ template_task_key: "a" }), b = task({ template_task_key: "b", depends_on: ["a"] });
    expect(availability(b, [a, b])).toMatchObject({ state: "blocked" });
    expect(availability(a, [a, b])).toEqual({ state: "ready" });
  });
  it("ignores N/A dependencies", () => {
    const a = task({ template_task_key: "a", is_applicable: false }), b = task({ template_task_key: "b", depends_on: ["a"] });
    expect(availability(b, [a, b]).state).toBe("ready");
  });
});

describe("focus and stage nodes", () => {
  it("shows a primary focus plus the parallel branch", () => {
    const e = task({ template_task_key: "e", section: "employer_journey" });
    const s = task({ template_task_key: "s", section: "sponsor_journey" });
    const f = focus([e, s]);
    expect(f.primary?.template_task_key).toBe("e");
    expect(f.parallel.map((t) => t.template_task_key)).toEqual(["s"]);
    const nodes = stageNodes([e, s], STAGES);
    expect(nodes.find((x) => x.section === "employer_journey")).toMatchObject({ isFocus: true, state: "not_started" });
    expect(nodes.find((x) => x.section === "sponsor_journey")).toMatchObject({ isParallel: true });
  });
  it("marks a stage in progress before it is complete, and N/A stages", () => {
    const e1 = task({ template_task_key: "e1", status: "completed" }), e2 = task({ template_task_key: "e2" });
    expect(stageNodes([e1, e2], STAGES)[0].state).toBe("in_progress");
    expect(stageNodes([], STAGES)[0].state).toBe("not_applicable");
  });
  it("counts waiting official tasks on the node", () => {
    const o = task({ template_task_key: "o", section: "sponsor_journey", external_verification: true, status: "awaiting_external_confirmation" });
    expect(stageNodes([o], STAGES).find((x) => x.section === "sponsor_journey")).toMatchObject({ waiting: 1, official: 1, officialConfirmed: 0 });
  });
});
