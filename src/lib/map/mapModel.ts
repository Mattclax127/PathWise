import type { JourneyTask } from "@/lib/journey/types";
import { STAGE_F } from "@/lib/map/roadGeometry";

/**
 * Turns saved journey tasks into what the illustrated map shows. Nothing here is stored and nothing here changes a task:
 * the map is a view of the journey engine's data. A checkpoint is a real task from the template, never invented filler.
 *
 * Rules (from the art direction spec):
 *  - A stage landmark lights up only when its gate task(s) are completed. Official gates (sponsor / government) show as
 *    "confirmed" and can never come from the applicant's own claim, because the engine already refuses that.
 *  - The character stands at the end of the unbroken run of finished nodes, in road order. Work finished out of order
 *    (employer and sponsor run in parallel) still shows as done on its own marker but does not move the character ahead.
 *  - Tasks that do not apply to this applicant are left off the road. Nothing is added to lengthen it.
 */
export type NodeStatus = "done" | "confirmed" | "waiting" | "next" | "upcoming";

export interface MapNode {
  id: string;
  kind: "stage" | "checkpoint";
  stage: number;
  title: string;
  status: NodeStatus;
  /** Only a sponsor, host or government office can confirm this one. */
  official: boolean;
  /** The stage's completion task does not exist in this journey yet (see docs/M3-MAP.md). */
  pending: boolean;
  /** Position along the road, 0 = start, 1 = finish. */
  f: number;
  taskKey: string | null;
}

export interface MapStage {
  index: number;
  section: string;
  name: string;
  href: string;
  status: NodeStatus;
  nodeIndex: number;
}

export interface MapModel {
  nodes: MapNode[];
  stages: MapStage[];
  /** Index of the node the character stands on, or -1 when it is still at the start line. */
  characterIndex: number;
  /** Where the character stands and how far the completed trail reaches (fraction of the road). */
  characterF: number;
  /** True only when the applicant has confirmed arrival. The only finish celebration. */
  finished: boolean;
}

interface StageDef {
  section: string;
  name: string;
  href: string;
  gate: string[];
  gateMode: "all" | "any";
  checkpoints: string[];
}

export const STAGE_DEFS: readonly StageDef[] = [
  { section: "profile_eligibility", name: "Profile & Eligibility", href: "/journey/stage/profile_eligibility", gate: ["complete_questionnaire"], gateMode: "all", checkpoints: [] },
  { section: "employer_journey", name: "Employer Journey", href: "/journey/employer", gate: ["host_offer_received", "record_host_details"], gateMode: "any", checkpoints: ["prepare_cv", "save_first_opportunity", "submit_first_application"] },
  { section: "sponsor_journey", name: "Sponsor Journey", href: "/journey/sponsor", gate: ["sponsor_accepts_application"], gateMode: "all", checkpoints: ["shortlist_sponsors", "choose_preferred_sponsor", "select_sponsor", "confirm_category_with_sponsor", "sponsor_reviews_host"] },
  { section: "document_preparation", name: "Document Preparation", href: "/journey/stage/document_preparation", gate: ["sponsor_issues_documents"], gateMode: "all", checkpoints: ["collect_sponsor_requirements", "draft_training_plan"] },
  { section: "visa_application", name: "Visa Application", href: "/journey/stage/visa_application", gate: ["visa_decision"], gateMode: "all", checkpoints: ["receive_program_documents", "pay_sevis_fee", "complete_ds160", "book_embassy_appointment"] },
  { section: "arrival_relocation", name: "Arrival & Relocation", href: "/journey/stage/arrival_relocation", gate: ["confirm_arrival"], gateMode: "all", checkpoints: ["plan_budget", "arrange_insurance", "plan_housing", "plan_travel"] },
];

const isDone = (t: JourneyTask) => t.status === "completed";

export function buildMapModel(tasks: JourneyTask[]): MapModel {
  const byKey = new Map<string, JourneyTask>();
  for (const t of tasks) byKey.set(t.template_task_key, t);
  const applicable = (key: string) => {
    const t = byKey.get(key);
    return t && t.is_applicable ? t : null;
  };

  type Draft = Omit<MapNode, "status" | "f"> & { done: boolean; waiting: boolean; f: number };
  const drafts: Draft[] = [];

  STAGE_DEFS.forEach((def, i) => {
    const cps = def.checkpoints.map(applicable).filter((t): t is JourneyTask => t !== null);
    const prevF = i === 0 ? 0 : STAGE_F[i - 1];
    cps.forEach((t, j) => {
      drafts.push({
        id: `${def.section}:${t.template_task_key}`, kind: "checkpoint", stage: i, title: t.title, official: t.external_verification,
        pending: false, taskKey: t.template_task_key, done: isDone(t), waiting: t.status === "awaiting_external_confirmation",
        f: prevF + ((STAGE_F[i] - prevF) * (j + 1)) / (cps.length + 1),
      });
    });
    const gates = def.gate.map(applicable).filter((t): t is JourneyTask => t !== null);
    const pending = gates.length === 0;
    const done = !pending && (def.gateMode === "all" ? gates.every(isDone) : gates.some(isDone));
    drafts.push({
      id: `${def.section}:stage`, kind: "stage", stage: i, title: def.name,
      official: gates.some((t) => t.external_verification), pending, taskKey: gates[0]?.template_task_key ?? null,
      done, waiting: !done && gates.some((t) => t.status === "awaiting_external_confirmation"), f: STAGE_F[i],
    });
  });

  // The end of the unbroken run of finished nodes decides where the character stands and which node is "next".
  const firstOpen = drafts.findIndex((d) => !d.done);
  const characterIndex = firstOpen === -1 ? drafts.length - 1 : firstOpen - 1;

  const nodes: MapNode[] = drafts.map((d, i) => {
    let status: NodeStatus;
    if (d.done) status = d.official ? "confirmed" : "done";
    else if (d.waiting) status = "waiting";
    else if (i === firstOpen) status = "next";
    else status = "upcoming";
    return { id: d.id, kind: d.kind, stage: d.stage, title: d.title, status, official: d.official, pending: d.pending, f: d.f, taskKey: d.taskKey };
  });

  const stages: MapStage[] = STAGE_DEFS.map((def, i) => {
    const nodeIndex = nodes.findIndex((n) => n.kind === "stage" && n.stage === i);
    return { index: i, section: def.section, name: def.name, href: def.href, status: nodes[nodeIndex].status, nodeIndex };
  });

  const last = nodes[nodes.length - 1];
  return {
    nodes, stages, characterIndex,
    characterF: characterIndex < 0 ? 0 : nodes[characterIndex].f,
    finished: last.kind === "stage" && !last.pending && (last.status === "done" || last.status === "confirmed"),
  };
}
