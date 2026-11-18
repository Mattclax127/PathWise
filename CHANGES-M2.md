# Milestone 2 changes (corrected package)

Read docs/M2-REVIEW.md (what was wrong) and docs/INSTALL-PATHWISE-DEV.md (how to install safely).

NEW or CHANGED vs the first Milestone 2 zip:
- supabase/migrations/0004_sponsor_refinements.sql (new, additive; 0003 unchanged)
- supabase/seeds/sponsors.generated.sql (regenerated: 5 published sponsors)
- data/sponsors/*.json (adds american-immigration-council, cultural-vistas, spirit-cultural-exchange; updates the rest)
- scripts/sponsors-to-sql.mjs, scripts/build-model.mjs, scripts/build-model.d.mts
- src/lib/sponsors/{types,compare}.ts, src/app/sponsors/{page.tsx,actions.ts}, src/components/SponsorExplorer.tsx
- tests/unit/compare.test.ts (extended), tests/unit/real-data.test.ts (new), tests/rls/sponsors.test.ts (fixed)

UNCHANGED: 0001_core.sql, 0002_seed_roadmap_template.sql, all auth, questionnaire, task, and dashboard code from the earlier Milestone 2 edit.
