import { describe, expect, it } from "vitest";
import { allowedStatuses, nextAction, progressPercent, sectionSummary, validateTransition } from "@/lib/journey/progress";
import type { JourneyTask } from "@/lib/journey/types";

let n = 0;
const task = (o: Partial<JourneyTask> & { template_task_key: string }): JourneyTask => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`, section: "employer_journey", title: o.template_task_key, description: "",
  position: n, status: "not_started", requires_evidence: false, external_verification: false, is_applicable: true, depends_on: [],
  notes: "", evidence_note: "", completed_at: null, ...o,
});

describe("progressPercent", () => {
  it("is 0 with no applicable tasks", () => expect(progressPercent([])).toBe(0));
  it("counts only applicable tasks", () => {
    const tasks = [task({ template_task_key: "a", status: "completed" }), task({ template_task_key: "b" }), task({ template_task_key: "c", is_applicable: false })];
    expect(progressPercent(tasks)).toBe(50);
  });
  it("is derived from task states, so changing a status changes it", () => {
    const a = task({ template_task_key: "a" }), b = task({ template_task_key: "b" });
    expect(progressPercent([a, b])).toBe(0);
    expect(progressPercent([{ ...a, status: "completed" }, b])).toBe(50);
    expect(progressPercent([{ ...a, status: "completed" }, { ...b, status: "completed" }])).toBe(100);
  });
  it("does not count in-progress or awaiting tasks as done", () => {
    expect(progressPercent([task({ template_task_key: "a", status: "in_progress" }), task({ template_task_key: "b", status: "awaiting_external_confirmation" })])).toBe(0);
  });
});

describe("sectionSummary", () => {
  it("reports state per section", () => {
    const t = [task({ template_task_key: "a", status: "completed" }), task({ template_task_key: "b", status: "in_progress" })];
    expect(sectionSummary(t, "employer_journey")).toMatchObject({ total: 2, completed: 1, percent: 50, state: "in_progress" });
    expect(sectionSummary(t, "visa_application").state).toBe("not_applicable");
  });
});

describe("nextAction", () => {
  it("skips blocked and non-applicable tasks", () => {
    const a = task({ template_task_key: "a" }), b = task({ template_task_key: "b", depends_on: ["a"] }), c = task({ template_task_key: "c", is_applicable: false });
    expect(nextAction([b, c, a])?.template_task_key).toBe("a");
  });
  it("unblocks a task when its dependency is completed, ignoring non-applicable dependencies", () => {
    const a = task({ template_task_key: "a", status: "completed" }), x = task({ template_task_key: "x", is_applicable: false }), b = task({ template_task_key: "b", depends_on: ["a", "x"] });
    expect(nextAction([a, x, b])?.template_task_key).toBe("b");
  });
  it("prefers actionable work over steps awaiting a third party", () => {
    const a = task({ template_task_key: "a", status: "awaiting_external_confirmation" }), b = task({ template_task_key: "b" });
    expect(nextAction([a, b])?.template_task_key).toBe("b");
  });
  it("returns null when everything is complete", () => expect(nextAction([task({ template_task_key: "a", status: "completed" })])).toBeNull());
});

describe("validateTransition", () => {
  it("blocks self-completion of third-party steps", () => {
    const t = task({ template_task_key: "sponsor_ok", external_verification: true });
    expect(validateTransition(t, [t], "completed", "")).toMatch(/third party/);
    expect(validateTransition(t, [t], "awaiting_external_confirmation", "")).toBeNull();
    expect(allowedStatuses(t)).not.toContain("completed");
  });
  it("requires evidence when flagged", () => {
    const t = task({ template_task_key: "sevis", requires_evidence: true });
    expect(validateTransition(t, [t], "completed", "  ")).toMatch(/evidence/i);
    expect(validateTransition(t, [t], "completed", "receipt #123")).toBeNull();
  });
  it("blocks completion until applicable dependencies are complete", () => {
    const a = task({ template_task_key: "a" }), b = task({ template_task_key: "b", depends_on: ["a"] });
    expect(validateTransition(b, [a, b], "completed", "")).toMatch(/first/);
    expect(validateTransition(b, [{ ...a, status: "completed" }, b], "completed", "")).toBeNull();
  });
  it("rejects changes to non-applicable tasks", () => {
    const t = task({ template_task_key: "a", is_applicable: false });
    expect(validateTransition(t, [t], "in_progress", "")).toMatch(/does not apply/);
  });
});
