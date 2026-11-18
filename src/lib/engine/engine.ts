import type { JourneyTask } from "@/lib/journey/types";
import { blockingTasks, nextAction } from "@/lib/journey/progress";

/**
 * Read-model for the journey map. Everything here is derived from saved task rows; nothing is stored.
 * The stored status enum stays small; the labels below distinguish "prepared" work from official confirmations.
 */
export type DisplayStatus = "not_applicable" | "not_started" | "in_progress" | "draft_ready" | "awaiting_response" | "externally_confirmed" | "completed";

export const DISPLAY_LABELS: Record<DisplayStatus, string> = {
  not_applicable: "Not applicable", not_started: "Not started", in_progress: "In progress", draft_ready: "Draft ready",
  awaiting_response: "Awaiting response", externally_confirmed: "Externally confirmed", completed: "Completed",
};

/** An "official" task is one only a sponsor, host, or government office can confirm. */
export const isOfficial = (t: JourneyTask) => t.external_verification;

export function displayStatus(t: JourneyTask): DisplayStatus {
  if (!t.is_applicable) return "not_applicable";
  switch (t.status) {
    case "completed": return isOfficial(t) ? "externally_confirmed" : "completed";
    case "awaiting_external_confirmation": return "awaiting_response";
    case "ready_for_review": return "draft_ready";
    case "in_progress": return "in_progress";
    default: return "not_started";
  }
}

export interface Ratio { done: number; total: number; percent: number }
const ratio = (done: number, total: number): Ratio => ({ done, total, percent: total ? Math.round((done / total) * 100) : 0 });

/** Two separate numbers, so a busy map never implies a visa is nearly approved. N/A tasks are excluded from both. */
export function progressSummary(tasks: JourneyTask[]): { prepared: Ratio; official: Ratio } {
  const applicable = tasks.filter((t) => t.is_applicable);
  const prep = applicable.filter((t) => !isOfficial(t));
  const off = applicable.filter(isOfficial);
  return {
    prepared: ratio(prep.filter((t) => t.status === "completed").length, prep.length),
    official: ratio(off.filter((t) => t.status === "completed").length, off.length),
  };
}

export type Availability = { state: "done" | "ready" | "waiting" | "blocked" | "not_applicable"; reason?: string };

/** "Locked" means action-dependent, never hidden. Users can open any task; this explains why an action is unavailable. */
export function availability(task: JourneyTask, all: JourneyTask[]): Availability {
  if (!task.is_applicable) return { state: "not_applicable", reason: "This step does not apply to your situation." };
  if (task.status === "completed") return { state: "done" };
  if (task.status === "awaiting_external_confirmation") return { state: "waiting", reason: "Waiting for the other party to confirm." };
  const b = blockingTasks(task, all);
  if (b.length) return { state: "blocked", reason: `Complete first: ${b.map((x) => x.title).join(", ")}` };
  return { state: "ready" };
}

export interface StageMeta { section: string; label: string; branch: "main" | "employer" | "sponsor"; position: number; map_x: number; map_y: number }
export interface StageNode extends StageMeta {
  total: number; done: number; official: number; officialConfirmed: number; waiting: number;
  state: "not_applicable" | "not_started" | "in_progress" | "completed"; isFocus: boolean; isParallel: boolean;
}

export function focus(tasks: JourneyTask[]) {
  const primary = nextAction(tasks);
  const parallel: JourneyTask[] = [];
  for (const section of ["employer_journey", "sponsor_journey"]) {
    const next = nextAction(tasks.filter((t) => t.section === section));
    if (next && next.id !== primary?.id) parallel.push(next);
  }
  return { primary, parallel };
}

export function stageNodes(tasks: JourneyTask[], stages: StageMeta[]): StageNode[] {
  const { primary, parallel } = focus(tasks);
  return [...stages].sort((a, b) => a.position - b.position || a.map_x - b.map_x).map((s) => {
    const list = tasks.filter((t) => t.section === s.section && t.is_applicable);
    const done = list.filter((t) => t.status === "completed").length;
    const off = list.filter(isOfficial);
    const touched = list.some((t) => t.status !== "not_started");
    return {
      ...s, total: list.length, done, official: off.length, officialConfirmed: off.filter((t) => t.status === "completed").length,
      waiting: list.filter((t) => t.status === "awaiting_external_confirmation").length,
      state: list.length === 0 ? "not_applicable" : done === list.length ? "completed" : touched ? "in_progress" : "not_started",
      isFocus: primary?.section === s.section, isParallel: parallel.some((p) => p.section === s.section),
    };
  });
}
