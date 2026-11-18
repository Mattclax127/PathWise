# M3: Illustrated journey map

The `/journey` page now shows an illustrated island map instead of the old node grid. It is a read-only view of the journey engine: nothing here writes a task, and the engine, migrations and Supabase data are untouched.

## How it works
- `src/lib/map/roadGeometry.ts`: the approved blueprint road (fixed 1600x900 space), plus `pointAt(f)` and `headingAt(f)`. Do not edit the path.
- `src/lib/map/mapModel.ts`: `buildMapModel(tasks)` turns saved tasks into stage landmarks and 2-5 checkpoints per stage. Every checkpoint is a real template task. Tasks that do not apply are left off.
- `src/components/map/IslandMap.tsx`: layered SVG (background, scenery, road, landmarks, ui), zoom/pan/pinch (viewBox only, so markers never drift), numbered badges on small screens, a stage list as the keyboard/phone equivalent, a peek panel with "Open workspace".
- `src/lib/map/artSvg.ts`: stand-in vector landmarks. Painted images can replace each landmark inside the same box (`ART_BOXES`) without touching the road or logic.
- `src/app/journey/stage/[section]`: calm full-screen workspace for stages without their own page (profile, documents, visa, arrival). Employer and sponsor keep `/journey/employer` and `/journey/sponsor`.

## Rules the map follows
- The character stands at the end of the unbroken run of finished nodes; work finished out of order shows on its own marker but does not move the character.
- Gold diamond = confirmed by a sponsor/government (only the engine's external facts can set that). Dashed coral ring = waiting on them. A claim by the applicant never shows as confirmed.
- Return animation plays only if saved progress changed since the last visit (localStorage), has a Skip button, and is off with reduced motion. The intro caption shows once.
- The finish celebration shows only when `confirm_arrival` is completed.

## Open item for you
The template has no `confirm_arrival` task yet, so the Arrival stage shows "not set up yet" and the finish never fires. `docs/proposed/0007_confirm_arrival.sql` is a proposal, not applied. Review it, move it into `supabase/migrations/` and run it only if you agree. Existing journeys would also need a backfill.

## Checks
Run on your machine: `npm run typecheck && npm test` (new tests: `tests/unit/mapModel.test.ts`). In the build sandbox only the model tests, a server render and screenshots could run; hydrated interactions (zoom, drag, animation, localStorage) were not exercised in a browser.
