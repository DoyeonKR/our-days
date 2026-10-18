# Couple-shared appearance

Home presentation uses the couple's server record when linked, rather than browser-only preferences.

`SharedAppearanceProvider` owns the presentation state for the entire authenticated page. Linked couples read `couples.shared_appearance` and `appearance_version`; writes use the member-only `save_couple_appearance` RPC with a compare-and-swap version. Home text/layout, theme colour and pixel/illustration mode share this same source. Authentication, device permissions, caches, unsent drafts and navigation are not shared.

The editor captures the version when opened. A partner update cannot silently overwrite a draft or be overwritten by a stale save. Failed saves retain input and never claim local-only data was shared. Existing browser text is available through an explicit import button, not automatically uploaded over the partner's settings.

Realtime uses the existing multiplexed couples subscription. Visible-page recovery runs every 30 seconds, and on focus, online and visibility restoration. Old reads cannot replace newer revisions. Scoped providers remount on account/couple changes.

## Rollout

1. Verify production migration history against local files first, as required by README section 7. On 2026-10-18 the logged-in production dashboard showed all ten existing migrations matching local files, latest `20260929000000_rls_setbased_and_grants`. The unavailable management plugin is not required when the authorized dashboard session can verify the same metadata.
2. Push the additive migration `20261018000000_shared_appearance.sql`, its identical bootstrap copy and client changes together. Main push automatically applies migrations; never rerun the full bootstrap on an existing database.
3. Check the Supabase GitHub integration as well as Pages CI. Verify columns, function grants, existing couples RLS and realtime publication. No direct column UPDATE grant should be added; the RPC validates payloads and membership.
4. Confirm both authenticated partners can save/read each other's settings and another couple cannot. Do not create or mutate real user data just to run destructive security tests.

Local SQL tests use isolated PGlite via `node scripts/shared-appearance-verify.mjs` (same optional local tooling as the existing RLS verifier). Browser QA uses in-memory adapters; pre-deployment results are recorded in `design/shared-appearance-review.json`. Production verification should query only schema/security metadata, not mutate real user data for testing.
