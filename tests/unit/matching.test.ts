import { describe, expect, it } from "vitest";
import { J1_LABEL, rankOpportunities, scoreOpportunity, type Opportunity } from "@/lib/engine/matching";

const o = (id: string, city: string, field: string, j1: Opportunity["j1_status"] = "unverified"): Opportunity => ({
  id, title: id, company_name: id, city, career_field: field, description: "", is_sample: true, source_label: "SAMPLE", j1_status: j1, j1_evidence_url: null,
});
const P = { destination_city: "Miami", career_field: "marketing" };

describe("matching", () => {
  it("scores city above field", () => {
    expect(scoreOpportunity(o("a", "Miami", "design"), P)).toBe(2);
    expect(scoreOpportunity(o("b", "Chicago", "marketing"), P)).toBe(1);
    expect(scoreOpportunity(o("c", "Miami", "marketing"), P)).toBe(3);
  });
  it("ranks best first, keeps ties stable, and hides saved or dismissed", () => {
    const list = [o("x", "Chicago", "design"), o("a", "Miami", "design"), o("b", "Miami", "marketing"), o("c", "Miami", "design")];
    expect(rankOpportunities(list, P, new Set()).map((v) => v.id)).toEqual(["b", "a", "c", "x"]);
    expect(rankOpportunities(list, P, new Set(["b", "a"])).map((v) => v.id)).toEqual(["c", "x"]);
  });
  it("never labels an unverified listing as J-1 compatible", () => {
    expect(J1_LABEL.unverified).toMatch(/unverified/i);
    expect(J1_LABEL.previous_j1_participation).toMatch(/not proof/i);
  });
});
