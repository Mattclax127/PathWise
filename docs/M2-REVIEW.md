# Milestone 2 review (original ZIP vs corrected)

## Bugs found in the original ZIP
1. BLOCKING. `saveSponsorOption` used `upsert()` on `journey_sponsor_options`, but users only hold UPDATE on (status, notes). An upsert also sets journey_id, user_id, and sponsor_id, so Postgres would deny it. Saving a sponsor would have failed. Fixed: update, then insert if nothing was updated. The RLS test now asserts the upsert is denied.
2. The engine added every insurance option together. Cultural Vistas lists several plans; that would have overcharged. Fixed with choice groups (lowest-priced option, stated in a note).
3. The engine could not price by student status, which Cultural Vistas requires. Fixed with applies_to_education; unknown status gives an unknown fee, not a guess.
4. Incomplete estimates showed only "Incomplete". They now show "At least $X (incomplete, not a total)" because unknown costs cannot be negative, and are listed after complete estimates without a rank.
5. No record of how designation was confirmed. Added designation_evidence and show it to applicants.

## Data
Only InterExchange had fees. Added Cultural Vistas, Spirit Cultural Exchange, and American Immigration Council from their own fee pages. CETUSA fees and CIEE remain unknown or unpublished.

## Not verifiable here
Running Next.js, vitest, SQL against Postgres, and RLS tests. The cost engine, data generator, and unit tests were run with Node; pure modules type-check under strict TypeScript.
