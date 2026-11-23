import { describe, it, expect } from "vitest";
import { assessFit } from "@/lib/waitlist/fit";

const base = { residence: "outside_us", status: "student", english: "good", months: 6, hospitality: false } as const;

describe("J-1 self-check", () => {
  it("matches current students and recent graduates to Intern", () => {
    expect(assessFit({ ...base }).category).toBe("intern");
    expect(assessFit({ ...base, status: "recent_grad" }).category).toBe("intern");
  });
  it("matches experienced graduates, and experience-only applicants, to Trainee", () => {
    expect(assessFit({ ...base, status: "grad_experience" }).category).toBe("trainee");
    expect(assessFit({ ...base, status: "experience_only" }).category).toBe("trainee");
  });
  it("does not guess when the profile does not match", () => {
    const r = assessFit({ ...base, status: "other" });
    expect(r.category).toBe("unsure");
    expect(r.headline).toContain("could not match");
  });
  it("warns when the stay is longer than the maximum, using 12 for interns and hospitality, 18 for other trainees", () => {
    expect(assessFit({ ...base, months: 13 }).notes.join(" ")).toContain("12-month");
    expect(assessFit({ ...base, status: "grad_experience", months: 15 }).notes.join(" ")).not.toContain("maximum");
    expect(assessFit({ ...base, status: "grad_experience", months: 19 }).notes.join(" ")).toContain("18-month");
    expect(assessFit({ ...base, status: "grad_experience", months: 14, hospitality: true }).notes.join(" ")).toContain("12-month");
  });
  it("always says only a sponsor can confirm eligibility, and never promises a result", () => {
    const r = assessFit({ ...base });
    expect(r.notes.join(" ")).toContain("Only a sponsor can confirm");
    expect(r.headline).toContain("may fit");
  });
  it("flags limited English and being in the U.S.", () => {
    const n = assessFit({ ...base, english: "limited", residence: "in_us" }).notes.join(" ");
    expect(n).toContain("enough English");
    expect(n).toContain("change of status");
  });
});
