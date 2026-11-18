// Shared by the SQL generator and the tests: turns one sponsor JSON file into normalized fee-schedule rows.
export function scheduleRows(s) {
  const programStatus = Object.fromEntries(s.programs.map((p) => [p.category, p.record_status]));
  const rows = [];
  for (const fs of s.fee_schedules) {
    for (const cat of fs.categories) {
      const status = programStatus[cat] === "verified" && s.sources[fs.source].review_status === "verified" ? "verified" : "needs_review";
      const components = [];
      if (fs.formula) {
        const f = fs.formula;
        for (let m = 1; m <= f.last_month; m++) {
          const cents = m <= f.step_until_month ? f.base_cents + (m - 1) * f.step_cents : f.base_cents + (f.step_until_month - 1) * f.step_cents + (m - f.step_until_month) * f.late_step_cents;
          components.push({ component_type: "sponsor_program_fee", label: `Program fee, ${m} month${m > 1 ? "s" : ""}`, amount_cents: cents, per: "one_time", is_mandatory: true, duration_min_months: m, duration_max_months: m, choice_group: null, notes: null });
        }
      }
      for (const c of fs.components ?? []) components.push({ per: "one_time", is_mandatory: true, duration_min_months: null, duration_max_months: null, choice_group: null, notes: null, ...c });
      for (const o of fs.optional_components ?? []) components.push({ component_type: "optional_service", label: o.label, amount_cents: o.amount_cents, per: "one_time", is_mandatory: false, duration_min_months: null, duration_max_months: null, choice_group: null, notes: o.notes ?? null });
      rows.push({
        category: cat, label: `${fs.label}, ${cat}`, applies_to_residence: fs.applies_to_residence ?? null, applies_to_education: fs.applies_to_education ?? null,
        is_itemized_complete: !!fs.is_itemized_complete, inclusions_confirmed: !!fs.inclusions_confirmed, notes: fs.notes ?? null, status,
        verified_at: s.sources[fs.source].verified_at, source: fs.source, inclusions: fs.inclusions ?? [], components,
      });
    }
  }
  return rows;
}
