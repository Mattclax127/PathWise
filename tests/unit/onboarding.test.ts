import { describe, expect, it } from "vitest";
import { STEPS, firstUnansweredKey, isAnswered, progressFraction, toQuestionnaire, validateAnswer, visibleSteps, type Answers } from "@/lib/engine/onboarding";
import { questionnaireSchema } from "@/lib/journey/questionnaire";

const FULL: Answers = {
  country_of_residence: "Brazil", citizenship: "Brazil", education_status: "recent_graduate", experience_level: "none", career_field: "marketing",
  program_category: "intern", destination_city: "Miami", duration_months: "6", budget_range: "8000_to_12000", host_state: "none",
  sponsor_state: "none", has_agency_quote: "no", service_level: "self",
};

describe("onboarding steps", () => {
  it("asks one question per step and skips the evidence step unless an offer is claimed", () => {
    expect(visibleSteps(FULL).some((s) => s.key === "host_evidence_note")).toBe(false);
    expect(visibleSteps({ ...FULL, host_state: "offer" }).some((s) => s.key === "host_evidence_note")).toBe(true);
  });
  it("resumes at the first unanswered visible question", () => {
    expect(firstUnansweredKey({})).toBe("country_of_residence");
    expect(firstUnansweredKey({ country_of_residence: "Brazil", citizenship: "Brazil" })).toBe("education_status");
    expect(firstUnansweredKey(FULL)).toBeNull();
    expect(firstUnansweredKey({ ...FULL, host_state: "offer" })).toBe("host_evidence_note");
  });
  it("tracks progress", () => {
    expect(progressFraction({})).toBe(0); expect(progressFraction(FULL)).toBe(1);
  });
  it("validates each answer as it is saved", () => {
    expect(validateAnswer("destination_city", "Paris")).toBeTruthy();
    expect(validateAnswer("destination_city", "Miami")).toBeNull();
    expect(validateAnswer("citizenship", "x")).toBeTruthy();
    expect(validateAnswer("nope", "x")).toBe("Unknown question.");
    expect(validateAnswer("host_evidence_note", "a".repeat(2001))).toBeTruthy();
  });
  it("every step has a unique key", () => expect(new Set(STEPS.map((s) => s.key)).size).toBe(STEPS.length));
  it("treats the optional evidence step as answered once visited", () => {
    const step = STEPS.find((s) => s.key === "host_evidence_note")!;
    expect(isAnswered(step, {})).toBe(false);
  });
});

describe("toQuestionnaire", () => {
  it("accepts a complete set and derives has_host", () => {
    const r = toQuestionnaire(FULL);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ has_host: false, host_state: "none", duration_months: 6, host_evidence_note: "" });
  });
  it("downgrades an offer without evidence to 'interested'", () => {
    const r = questionnaireSchema.safeParse({ ...FULL, host_state: "offer", host_evidence_note: "" });
    expect(r.success && r.data.host_state).toBe("interested");
  });
  it("keeps an offer that has evidence", () => {
    const r = toQuestionnaire({ ...FULL, host_state: "offer", host_evidence_note: "Offer email 3 Nov" });
    expect(r.success && r.data.host_state).toBe("offer");
  });
  it("rejects missing answers", () => expect(toQuestionnaire({ ...FULL, citizenship: "" }).success).toBe(false));
});
