export type Category = "intern" | "trainee";
export type SelfPlacement = "accepted" | "required" | "conditional" | "not_accepted" | "unknown";
export type ComponentType = "sponsor_program_fee" | "processing" | "sevis_fee" | "visa_fee" | "insurance" | "other_mandatory" | "optional_service";

export interface Source { id: string; url: string; info_type: string; verified_at: string; review_status: string; note: string | null }
export type DesignationEvidence = "state_directory" | "sponsor_statement";
export interface Program { id: string; category: Category; designation_evidence: DesignationEvidence; fields: string[]; min_duration_months: number | null; max_duration_months: number | null; verified_at: string | null; notes: string | null }
export interface Policy { policy_key: "self_placement"; value: SelfPlacement; detail: string | null; source_id: string | null; verified_at: string | null }
export interface Requirement { id: string; category: Category | null; requirement_type: string; description: string; countries: string[] | null; country_mode: "only" | "excluded" | null; source_id: string | null }
export interface Component { id: string; component_type: ComponentType; label: string; amount_cents: number | null; per: "one_time" | "per_month"; is_mandatory: boolean; choice_group: string | null; duration_min_months: number | null; duration_max_months: number | null; notes: string | null }
export interface Inclusion { service_key: string; detail: string | null }
export interface Schedule {
  id: string; category: Category; label: string; applies_to_residence: string[] | null; applies_to_education: string[] | null; currency: string;
  is_itemized_complete: boolean; inclusions_confirmed: boolean; notes: string | null; verified_at: string; source_id: string;
  sponsor_fee_components: Component[]; sponsor_fee_inclusions: Inclusion[];
}
export interface SponsorBundle {
  id: string; slug: string; name: string; website_url: string | null; contact_phone: string | null; address: string | null;
  designation_source_url: string | null; designation_verified_at: string | null; is_sample: boolean; notes: string | null;
  sponsor_programs: Program[]; sponsor_policies: Policy[]; sponsor_requirements: Requirement[]; sponsor_sources: Source[]; sponsor_fee_schedules: Schedule[];
}
export interface GovFee { key: string; label: string; amount_cents: number | null; applies_to_categories: Category[]; included_in_comparison: boolean; source_url: string; verified_at: string; note: string | null }
