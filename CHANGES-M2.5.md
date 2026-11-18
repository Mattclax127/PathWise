# Milestone 2.5 changes
New: migrations 0005/0006, seeds, `src/lib/engine/*`, `/journey`, `/journey/employer`, `/journey/sponsor`, onboarding wizard, JourneyMap, OpportunityDeck, ApplicationWorkspace, ResumeSetup, ClaimForm, `tests/sql/*`, `tests/unit/{engine,onboarding,matching,resume}.test.ts`.
Changed: questionnaire schema/page/actions (one question at a time; `host_state`, `sponsor_state`, `service_level`), TaskList (display labels, action links), dashboard (link to map), layout nav, proxy (protects /journey), next.config (6 MB server action body), globals.css (map styles).
Removed: `QuestionnaireForm.tsx` (replaced by `OnboardingWizard.tsx`).
