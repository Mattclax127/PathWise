import { SECTIONS, type JourneyTask, type SectionKey, type TaskStatus, TASK_STATUSES } from "./types";

/** Pure functions: progress is always derived from saved task states, never stored or hard-coded. */
export const applicableTasks = (tasks: JourneyTask[]) => tasks.filter((t) => t.is_applicable);

export function progressPercent(tasks: JourneyTask[]): number {
  const list = applicableTasks(tasks);
  if (list.length === 0) return 0;
  return Math.round((list.filter((t) => t.status === "completed").length / list.length) * 100);
}

export type SectionState = "not_applicable" | "not_started" | "in_progress" | "completed";
export interface SectionSummary { key: SectionKey; label: string; total: number; completed: number; percent: number; state: SectionState }

export function sectionSummary(tasks: JourneyTask[], key: SectionKey): SectionSummary {
  const label = SECTIONS.find((s) => s.key === key)!.label;
  const list = applicableTasks(tasks).filter((t) => t.section === key);
  const completed = list.filter((t) => t.status === "completed").length;
  const touched = list.some((t) => t.status !== "not_started");
  const state: SectionState = list.length === 0 ? "not_applicable" : completed === list.length ? "completed" : touched ? "in_progress" : "not_started";
  return { key, label, total: list.length, completed, percent: list.length ? Math.round((completed / list.length) * 100) : 0, state };
}

/** Titles of applicable dependencies that are not completed yet. */
export function blockingTasks(task: JourneyTask, tasks: JourneyTask[]): JourneyTask[] {
  return tasks.filter((d) => d.is_applicable && task.depends_on.includes(d.template_task_key) && d.status !== "completed");
}

export function nextAction(tasks: JourneyTask[]): JourneyTask | null {
  const open = applicableTasks(tasks)
    .filter((t) => t.status !== "completed" && blockingTasks(t, tasks).length === 0)
    .sort((a, b) => a.position - b.position);
  // Prefer something you can act on over something waiting on a third party.
  return open.find((t) => t.status !== "awaiting_external_confirmation") ?? open[0] ?? null;
}

/** Mirrors the database trigger so the UI can explain rules early. The database is the source of truth. */
export function validateTransition(task: JourneyTask, tasks: JourneyTask[], next: TaskStatus, evidenceNote: string): string | null {
  if (!TASK_STATUSES.includes(next)) return "Unknown status.";
  if (!task.is_applicable) return "This step does not apply to your situation.";
  if (next !== "completed") return null;
  if (task.external_verification) return "This step must be confirmed by a third party. Mark it as awaiting confirmation instead.";
  if (task.requires_evidence && evidenceNote.trim() === "") return "Add evidence (a link, reference number, or short note) before completing this task.";
  const blocking = blockingTasks(task, tasks);
  if (blocking.length) return `Complete these steps first: ${blocking.map((b) => b.title).join(", ")}`;
  return null;
}

export function allowedStatuses(task: JourneyTask): TaskStatus[] {
  return task.external_verification ? TASK_STATUSES.filter((s) => s !== "completed" || task.status === "completed") : [...TASK_STATUSES];
}
