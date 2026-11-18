export const TASK_STATUSES = ["not_started", "in_progress", "ready_for_review", "awaiting_external_confirmation", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  awaiting_external_confirmation: "Awaiting external confirmation",
  completed: "Completed",
};

export const SECTIONS = [
  { key: "profile_eligibility", label: "Profile & Eligibility" },
  { key: "employer_journey", label: "Employer Journey" },
  { key: "sponsor_journey", label: "Sponsor Journey" },
  { key: "document_preparation", label: "Document Preparation" },
  { key: "visa_application", label: "Visa Application" },
  { key: "arrival_relocation", label: "Arrival & Relocation" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

export interface JourneyTask {
  id: string;
  template_task_key: string;
  section: SectionKey;
  title: string;
  description: string;
  position: number;
  status: TaskStatus;
  requires_evidence: boolean;
  external_verification: boolean;
  is_applicable: boolean;
  depends_on: string[];
  notes: string;
  evidence_note: string;
  completed_at: string | null;
  responsibility?: "applicant" | "host" | "sponsor" | "government";
  action_href?: string | null;
}

export interface Journey {
  id: string;
  destination_city: string;
  intended_category: "intern" | "trainee";
}
