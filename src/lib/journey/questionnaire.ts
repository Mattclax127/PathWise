import { z } from "zod";

export const OPTIONS = {
  education_status: [["current_student", "Current student"], ["recent_graduate", "Recent graduate"], ["graduate_with_experience", "Graduate with experience"]],
  experience_level: [["none", "None"], ["under_1_year", "Under 1 year"], ["1_to_3_years", "1 to 3 years"], ["3_plus_years", "3+ years"]],
  career_field: [["marketing", "Marketing"], ["hospitality", "Hospitality"], ["technology", "Technology"], ["business", "Business"], ["design", "Design"], ["other", "Other"]],
  program_category: [["intern", "Intern"], ["trainee", "Trainee"]],
  destination_city: [["Miami", "Miami"], ["Orlando", "Orlando"], ["New York City", "New York City"], ["Chicago", "Chicago"], ["Los Angeles", "Los Angeles"]],
  duration_months: [["3", "3 months"], ["6", "6 months"], ["9", "9 months"], ["12", "12 months"]],
  budget_range: [["under_8000", "Under $8,000"], ["8000_to_12000", "$8,000 to $12,000"], ["12000_plus", "$12,000+"]],
  host_state: [["none", "No, I am still looking"], ["interested", "A company has shown interest (nothing in writing yet)"], ["offer", "Yes, I have a written offer or host confirmation"]],
  sponsor_state: [["none", "No, I have not chosen a sponsor"], ["applied", "I have applied to a sponsor"], ["accepted", "A sponsor says they accepted me"]],
  has_agency_quote: [["no", "No quote yet"], ["yes", "I have an agency quote"]],
  service_level: [["self", "Self-service (available now)"], ["assisted_waitlist", "I would like assisted help (not available yet; join the waitlist)"]],
} as const;

const oneOf = (key: keyof typeof OPTIONS) => z.enum(OPTIONS[key].map((o) => o[0]) as [string, ...string[]], { error: "Choose an option." });
const text = z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Keep this under 80 characters.");

export const questionnaireSchema = z.object({
  country_of_residence: text,
  citizenship: text,
  education_status: oneOf("education_status"),
  experience_level: oneOf("experience_level"),
  career_field: oneOf("career_field"),
  program_category: oneOf("program_category"),
  destination_city: oneOf("destination_city"),
  duration_months: oneOf("duration_months").transform(Number),
  budget_range: oneOf("budget_range"),
  host_state: oneOf("host_state"),
  host_evidence_note: z.string().trim().max(2000, "Keep this under 2,000 characters.").optional().default(""),
  sponsor_state: oneOf("sponsor_state"),
  has_agency_quote: oneOf("has_agency_quote").transform((v) => v === "yes"),
  service_level: oneOf("service_level"),
}).transform((v) => ({ ...v, has_host: v.host_state !== "none" }))
  // an offer is only recorded as an offer when the applicant gives evidence; otherwise it is "interested"
  .transform((v) => (v.host_state === "offer" && v.host_evidence_note === "" ? { ...v, host_state: "interested" as const } : v));
export type QuestionnaireRow = z.output<typeof questionnaireSchema>;

export const LABELS: Record<string, string> = {
  country_of_residence: "Country of residence", citizenship: "Citizenship", education_status: "Education status",
  experience_level: "Relevant experience", career_field: "Career field", program_category: "Program",
  destination_city: "Preferred U.S. city", duration_months: "Program length", budget_range: "Approximate budget",
  host_state: "Do you already have a host company?", host_evidence_note: "Evidence of the offer (link, email subject, reference)",
  sponsor_state: "Where are you with a designated sponsor?", has_agency_quote: "Agency quote?", service_level: "How would you like to use PathWise?",
};
