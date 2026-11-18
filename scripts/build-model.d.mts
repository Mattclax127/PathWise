export interface ScheduleRow {
  category: "intern" | "trainee"; label: string; applies_to_residence: string[] | null; applies_to_education: string[] | null;
  is_itemized_complete: boolean; inclusions_confirmed: boolean; notes: string | null; status: string; verified_at: string; source: string;
  inclusions: { service_key: string; detail: string | null }[];
  components: { component_type: string; label: string; amount_cents: number | null; per: "one_time" | "per_month"; is_mandatory: boolean; duration_min_months: number | null; duration_max_months: number | null; choice_group: string | null; notes: string | null }[];
}
export function scheduleRows(sponsor: unknown): ScheduleRow[];
