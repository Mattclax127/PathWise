import { OPTIONS, LABELS, questionnaireSchema } from "@/lib/journey/questionnaire";

export type Answers = Record<string, string>;
export interface Step {
  key: string; kind: "text" | "choice" | "longtext"; title: string; help?: string; optional?: boolean;
  options?: readonly (readonly [string, string])[]; showIf?: (a: Answers) => boolean;
}

const choice = (key: keyof typeof OPTIONS, title: string, help?: string, showIf?: Step["showIf"]): Step =>
  ({ key, kind: "choice", title, help, options: OPTIONS[key], showIf });

/** One question per screen. Conditional steps are skipped when they do not apply. */
export const STEPS: Step[] = [
  { key: "country_of_residence", kind: "text", title: "Which country do you live in?" },
  { key: "citizenship", kind: "text", title: "What is your citizenship?" },
  choice("education_status", "Where are you in your education?"),
  choice("experience_level", "How much relevant experience do you have?"),
  choice("career_field", "Which field do you want to train in?"),
  choice("program_category", "Which J-1 category are you interested in?", "This is your selection, not an eligibility decision. A designated sponsor decides eligibility."),
  choice("destination_city", "Which U.S. city do you want?"),
  choice("duration_months", "How long do you want to stay?"),
  choice("budget_range", "What is your approximate budget?"),
  choice("host_state", "Do you already have a host company?", "Interest or a reply from a company is not the same as a host."),
  { key: "host_evidence_note", kind: "longtext", title: "Add evidence of the offer", optional: false,
    help: "A link, the email subject and date, or a reference number. Without evidence we record your host as \"interested\".", showIf: (a) => a.host_state === "offer" },
  choice("sponsor_state", "Where are you with a designated sponsor?", "Selecting or applying to a sponsor is not the same as being accepted. Acceptance has to be confirmed by the sponsor."),
  choice("has_agency_quote", "Do you have a quote from a placement agency?"),
  choice("service_level", "How would you like to use PathWise?", "PathWise is self-service today. Assisted help is not live yet, and joining the waitlist promises nothing."),
];

export const visibleSteps = (a: Answers) => STEPS.filter((s) => !s.showIf || s.showIf(a));
export const isAnswered = (s: Step, a: Answers) => (s.optional ? a[s.key] !== undefined : (a[s.key] ?? "").trim() !== "");
export const firstUnansweredKey = (a: Answers): string | null => visibleSteps(a).find((s) => !isAnswered(s, a))?.key ?? null;
export const progressFraction = (a: Answers) => { const v = visibleSteps(a); return v.length ? v.filter((s) => isAnswered(s, a)).length / v.length : 0; };

/** Validates one answer so bad values are rejected as the user goes, not only at the end. */
export function validateAnswer(key: string, value: string): string | null {
  const step = STEPS.find((s) => s.key === key);
  if (!step) return "Unknown question.";
  const v = value.trim();
  if (step.kind === "choice") return step.options!.some(([o]) => o === v) ? null : "Choose one of the options.";
  if (step.kind === "text") return v.length >= 2 && v.length <= 80 ? null : "Enter between 2 and 80 characters.";
  return v.length <= 2000 ? null : "Keep this under 2,000 characters.";
}

export function toQuestionnaire(a: Answers) {
  const v = visibleSteps(a);
  const input: Answers = {}; for (const s of v) input[s.key] = a[s.key] ?? "";
  if (!v.some((s) => s.key === "host_evidence_note")) input.host_evidence_note = "";
  return questionnaireSchema.safeParse(input);
}
export const answerLabel = (key: string, value: string) => OPTIONS[key as keyof typeof OPTIONS]?.find(([v]) => v === value)?.[1] ?? value;
export const questionLabel = (key: string) => LABELS[key] ?? key;
