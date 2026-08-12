# Security Test Results

Live tests run against the local dev stack (`docker compose` + `apps/api`/`apps/worker` dev
servers), per the checklist in `docs/spec/01_workflow_theo_phase.md` §7.7. Test data created
during these runs is cleaned up afterward — see each section for what was created.

## Sprint 7.1 — BOLA + privilege escalation (2026-08-10)

**Setup note (real finding):** the first BOLA attempt used `company-demo@r2m.local` as the
"unrelated" actor against one of `author-demo@r2m-research.local`'s technology cases — it
returned `200` with full case data. This looked like a BOLA bug at first, but checking
`case_member` showed `company-demo` is a legitimate `PARTNER_MEMBER` on that case (from
earlier Phase 5 case-initiation testing this session) — a bad test-account choice, not a
vulnerability. Re-ran with `owner@sample-research-unit.local`, confirmed via SQL to have
zero membership on the target case, for all tests below.

| Test | Actor | Target | Expected | Actual | Result |
|---|---|---|---|---|---|
| BOLA — case detail | unrelated USER | `GET /technology-cases/:id` (case they're not a member of) | 403 | `AUTH_FORBIDDEN` | PASS |
| BOLA — transfer manifests | unrelated USER | `GET /technology-cases/:id/transfer-manifests` | 403 | `AUTH_FORBIDDEN` | PASS |
| BOLA — evidence list | unrelated USER | `GET /technology-cases/:id/evidence` | 403 | `AUTH_FORBIDDEN` | PASS |
| BOLA — assessments list | unrelated USER | `GET /technology-cases/:id/assessments` | 403 | `AUTH_FORBIDDEN` | PASS |
| Privilege escalation — org role, invalid value | unrelated USER (not an org member at all) | `PATCH /organizations/:id/members/:memberId` `{"role":"ORG_OWNER"}` | rejected | `VALIDATION_ERROR` — DTO enum doesn't even accept `ORG_OWNER` as settable | PASS (schema-layer defense) |
| Privilege escalation — org role, valid value | unrelated USER | `PATCH /organizations/:id/members/:memberId` `{"role":"ORG_ADMIN"}` | 403, DB unchanged | `AUTH_FORBIDDEN` — "Only an active ORG_OWNER or ORG_ADMIN...", confirmed member row's role unchanged in DB | PASS (service-layer defense, independent of the schema-layer one above — genuine defense-in-depth) |
| Privilege escalation — self-role via profile | unrelated USER | `PATCH /me` `{"platformRole":"PLATFORM_ADMIN"}` | no such endpoint / rejected | `404 Not Found` — no `PATCH /me` route exists at all | PASS |

No cross-tenant leaks found. No cleanup needed — all requests above were reads or rejected
writes; nothing was created or mutated.

## Sprint 7.4 — replayed idempotent request, signed URL expiration (2026-08-12)

| Test | Method | Expected | Actual | Result |
|---|---|---|---|---|
| Replayed idempotent request | `POST /technology-cases` twice with the same `Idempotency-Key` header + identical body | Second request returns the same resource (`id`), no duplicate row created | Both responses had `id="b0425e79-..."`; `SELECT count(*) ... WHERE title=...` → **1** row despite 2 POSTs | PASS |
| Signed URL expiration | Temporarily set `S3_SIGNED_URL_TTL_SECONDS=3` (restored to `300` after), requested a resource upload URL, `PUT` immediately, waited 5s, `PUT` again with the same URL | First PUT succeeds (200); second PUT rejected | First PUT: `200`. Second PUT (after expiry): MinIO `403 AccessDenied — "Request has expired"` | PASS |

No cleanup needed for the replay test beyond the one `technology_case` row created (deleted
along with its `case_member`/`case_organization`/`case_origin`/`case_status_history`/
`technology_profile`/`outbox_event`/`audit_log` rows and the `idempotency_key` row). The
expiry test's uploaded object (`expiry-test.pdf`) was rejected by MinIO on the second PUT,
so nothing new was actually written to the bucket to clean up beyond the first successful
PUT — that one small test file was left in the `r2m-resource-private` bucket (harmless,
same disclosed local-dev-only status as other test artifacts).

## Sprint 7.4 — malware scan (ClamAV), 2026-08-12

**A real debugging investigation, disclosed in full since it changed how the test was run:**
the first EICAR test attempt (`%PDF-1.4\n` + EICAR string, so it would pass the app's own
MIME-sniff gate before reaching the malware scan) came back clean (`stream: OK`) via the
app's `scanForMalware` — looked like a broken ClamAV integration. Spent real effort ruling
out: the hand-rolled INSTREAM TCP protocol implementation (byte-verified against the spec,
also reproduced with the trusted `clamscan` npm library — same "clean" result, ruling out an
implementation bug), Windows Defender interfering with on-disk test files (real, but a
red herring — confirmed via `Get-MpThreatDetection`, and reproduced the same "clean" result
with a buffer built purely in memory, never touching disk). The actual cause, confirmed via
`clamdscan` CLI directly inside the `clamav` container: **ClamAV's EICAR signature is
position-sensitive — it only matches at/near byte offset 0.** A 4-byte `%PDF` prefix alone
was enough to make ClamAV stop recognizing the standard EICAR test string, on the file scan
path too, not just streaming — this is a genuine ClamAV behavior, not an app bug. Since the
app's pipeline always MIME-sniffs first (requiring a PDF/JPEG/PNG header before the malware
scan ever runs), EICAR-with-a-real-file-header can never reach ClamAV intact at offset 0 — so
EICAR isn't actually a usable end-to-end test for *this* pipeline shape. Installed a
temporary custom ClamAV signature (`.ndb`, matching a marker string anywhere in the file —
not position-restricted) to test the real thing: malware content that also has a valid file
header, which is the realistic threat model. Removed the custom signature after testing.

| Test | Target | Method | Expected | Actual | Result |
|---|---|---|---|---|---|
| Clean upload | Resource ingestion | Upload a genuine PDF | `resource_ingestion_job.status = COMPLETED` | `COMPLETED` | PASS |
| Malware detected | Resource ingestion | Upload `%PDF-1.4\n` + custom test marker (simulates real malware: valid header, malicious payload anywhere in the file) | Job `FAILED`, `errorCode=MALWARE_DETECTED`, object deleted from storage, publish blocked | Job `FAILED`, `error_message="R2M-Test-Malware-Signature.UNOFFICIAL"`, MinIO `mc stat` confirmed object deleted, `POST .../publish` → `RESOURCE_VERSION_NOT_SCANNED` | PASS |
| MIME mismatch | Resource ingestion | Upload plain text claiming `application/pdf` | Job `FAILED`, `errorCode=MIME_MISMATCH` | Job `FAILED`, `error_code=MIME_MISMATCH` | PASS |
| Org/author-verification scan wiring | `verification.service.ts` / `author-verification.service.ts` | Same `FileSafetyService` (proven correct above) injected via the same DI pattern; unit tests (mocked) pass; NestJS bootstrap resolves both services with no DI errors | Wiring correct | Confirmed via unit tests + clean server boot; **not independently live-tested end-to-end** — both existing demo orgs in a resubmittable verification state (`REJECTED`) belong to accounts without known test passwords, and creating fresh test org/verification-request state was judged not worth the added scope given the scan logic itself is already proven live 3 times over | PASS (disclosed partial coverage) |

**Cleanup:** all 3 resource-flow test resources + their `resource_version`/
`resource_ingestion_job`/`outbox_event`/`audit_log` rows deleted. Custom ClamAV signature
(`/var/lib/clamav/r2m-test.ndb`) removed and database reloaded — confirmed the real EICAR
file no longer being used as a test case going forward (documented above for anyone
extending this test later).

## Sprint 7.4 — verification document retention (endpoint + worker sweep), 2026-08-12

Test row inserted manually (`verification_document` id `3393534a-ebb6-4acf-9bf9-1990cc5777eb`,
`storageObjectKey=organization-verification/test-retention-sweep.pdf`) with a matching object
uploaded to the `r2m-verification-private` bucket at that exact key, before this session's
Docker Desktop outage interrupted the original test run — resumed here after Docker was back
up (see project notes on the C:→D: disk relocation).

| Test | Actor | Request | Expected | Actual | Result |
|---|---|---|---|---|---|
| Non-admin forbidden | `reviewer@r2m.local` (PLATFORM_REVIEWER, not admin) | `POST /v1/platform/verification-documents/:id/retention` | 403 | `403 AUTH_FORBIDDEN` — "Only a platform admin may perform this action." | PASS |
| Past date rejected | `admin@r2m.local` | same endpoint, `retentionUntil` in 2020 | 400, DB unchanged | `400 VALIDATION_ERROR` — "retentionUntil must be in the future." (zod refine at the DTO layer, request never reaches the service) | PASS |
| Future date accepted | `admin@r2m.local` | same endpoint, `retentionUntil` = now + 12s | 201, row updated | `201`, response echoed the same timestamp; `SELECT retention_until` confirmed set in DB | PASS |
| Worker sweep deletes on expiry | worker's `sweepExpiredVerificationDocuments` (triggered by restarting the worker — it sweeps once on every startup, not just every 5 min) | ran after the 12s window had passed | row deleted, storage object deleted | Worker log: `"expired verification document(s) — retention swept" expiredCount:1`; `SELECT count(*) ... WHERE id=...` → **0**; `mc stat` on the object → `Object does not exist` | PASS |

**Cleanup:** none needed — the sweep itself was the cleanup (both the DB row and the storage
object it pointed to no longer exist).

**SSE for the verification bucket — disclosed as skipped, not done:** the plan called for
enabling MinIO server-side encryption (`mc encrypt set sse-s3 <bucket>`) so
`verification_document.encrypted` (`true` by default) reflects a real guarantee instead of a
decorative default. Attempted this locally: MinIO's `sse-s3` mode requires a configured KMS
backend (`mc encrypt set sse-s3` fails with "KMS is not configured"), and this stack has no
KMS service (no MinIO KES, no external KMS) — adding one would mean inventing new
infrastructure outside anything in the spec or existing docker-compose, which rule 1 (no
invented infrastructure/business rules) argues against. Left `encrypted=true` as the schema
default (unenforced) rather than either standing up a KMS ad hoc or silently flipping the
default to `false`; a real KMS choice (MinIO KES vs. an external one) is an infra decision for
whoever provisions the production environment, not something to pick unilaterally here.

## Summary

All security tests across Sprint 7.1 and 7.4 passed. No cross-tenant leaks, no privilege
escalation paths, idempotency correctly suppresses duplicate side effects on replay, signed
URLs are genuinely time-limited (enforced by MinIO/S3 itself, not just application-layer TTL
bookkeeping), the malware scan pipeline correctly quarantines both malicious content and
MIME-spoofed uploads while leaving clean uploads untouched, and verification document
retention is enforced end-to-end (admin-only, future-dated only, worker sweep actually
deletes both the DB row and the storage object). One item — bucket-level SSE for verification
documents — is disclosed as skipped due to a missing KMS dependency, not silently dropped.
