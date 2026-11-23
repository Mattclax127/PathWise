/**
 * Self-check only. It is NOT an eligibility decision: only a designated J-1 sponsor decides who qualifies.
 * Rules mirror the published Intern/Trainee categories: interns are current students or recent graduates (max 12 months);
 * trainees are graduates with work experience (max 18 months; hospitality is capped at 12 for both).
 */
export type ApplicantStatus = "student" | "recent_grad" | "grad_experience" | "experience_only" | "other";
export interface FitInput { residence: "outside_us" | "in_us"; status: ApplicantStatus; english: "good" | "limited"; months: number; hospitality: boolean }
export interface FitResult { category: "intern" | "trainee" | "unsure"; headline: string; notes: string[] }

export function assessFit(i: FitInput): FitResult {
  const notes: string[] = [];
  let category: FitResult["category"] = "unsure";
  if (i.status === "student" || i.status === "recent_grad") category = "intern";
  else if (i.status === "grad_experience" || i.status === "experience_only") category = "trainee";

  const cap = i.hospitality ? 12 : category === "trainee" ? 18 : 12;
  if (category !== "unsure" && i.months > cap) notes.push(`Your planned length (${i.months} months) is above the usual ${cap}-month maximum for this path${i.hospitality ? " in hospitality" : ""}. A sponsor would ask you to shorten it.`);
  if (i.english === "limited") notes.push("Sponsors require enough English to take part in the program, so expect them to check.");
  if (i.residence === "in_us") notes.push("You are in the U.S. now. Some sponsors do not handle a change of status from another visa, so ask before you plan around it.");
  if (category === "unsure") notes.push("Your situation does not match the usual Intern or Trainee profile. A sponsor can tell you if another route fits.");
  notes.push("Even unpaid or short internships need a designated sponsor. Only a sponsor can confirm you qualify.");

  const headline = category === "intern" ? "The J-1 Intern path may fit you." : category === "trainee" ? "The J-1 Trainee path may fit you." : "We could not match you to a path yet.";
  return { category, headline, notes };
}
