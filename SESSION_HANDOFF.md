# Session handoff — paste this into the next chat

> Save this file. Open the next Claude session and tell it: **"Read `SESSION_HANDOFF.md` at the repo root and continue from there."** That's all it needs.

---

## Where we are right now

- **Branch:** `claude/loving-brahmagupta-0daecc` — pushed to GitHub.
- **Last commit:** `f70464c` (default sender → `hr@qualityonecare.com`)
- **Unmerged commits sitting on the branch:** 9 commits since your last merge to `main`. **DO NOT MERGE YET** — Aaina explicitly said she wants to batch-merge after collecting more fixes.
- **Compare URL when ready to merge:** https://github.com/aina-git/quality-one-care-hr-portal/compare/main...claude/loving-brahmagupta-0daecc

## What's currently on `main` and live (already merged + deployed)

- 14-step applicant intake wizard at `/applicant/intake`
- Branded login / register pages
- HR Identity Cross-Check with Resolve/Revoke
- Verification page with stat-strip + blocker-reason fix
- Admin Users page with per-row Delete + Danger Zone "Reset users & alerts"
- Notification dedup (the "29 of the same alert" inflation fix)
- Live applicant monitor at `/hr/applicants/live`
- Email + SMS-via-email-gateway dispatcher (queued, **not yet sending** — see "Pending env config")
- Phone-based registration with auto-generated password sent via SMS gateway
- ConfirmContactInfoBanner — persistent prompt when HR created an applicant with placeholder email/phone
- Address autocomplete (Nominatim, free, no key) on every applicant address field
- IdentityMatchBadge — real-time check that typed address matches uploaded driver's license
- Inline Quick Fix on every Critical Blocker row — one-click verify
- Non-expirable categories (Employment History, References, OIG) no longer flagged as expired
- W-9, W-4, MW507 auto-prefill name + address from earlier-entered intake data
- MBON URL: `https://lookup.mbon.org/verification/`
- Nursys URL: `https://www.nursys.com/LQC/LQCSearch.aspx`
- CJIS Google Form URL + `qualityonecare39@gmail.com` login email pill (with Copy)
- Global MM/DD/YYYY date format
- Default sender for all outbound email = `hr@qualityonecare.com` (NOT `aaina@`)

## What's pending merge (latest 9 commits)

In order, oldest first — all on the branch, ready to merge as one batch:

1. `7ef2e80` — Inline Quick Fix on each Critical Blocker
2. `1386183` — Stop treating non-expirable verifications as expired
3. `a5d9507` — Phone-based registration + SMS login + temp-contact prompts
4. `354ffc0` — Address autocomplete on every applicant address field
5. `52b7635` — Real-time identity match badge (compares typed address against DL)
6. `298ebf0` — Auto-prefill W-9 / W-4 / MW507 with name + address
7. `c46fdb9` — MBON + Nursys URLs + global MM/DD/YYYY
8. `2be629d` — CJIS Google Form URL
9. `1c8867e` — CJIS login email pill with Copy
10. `f70464c` — Default sender = `hr@qualityonecare.com`

## Open items waiting on Aaina's input

These need decisions/answers before I can ship:

| Item | What I need |
|---|---|
| **Email delivery is wired but not sending** | Pick Resend or SendGrid. Sign up, verify `qualityonecare.com` domain via DNS, set 3 Railway env vars (`EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM=hr@qualityonecare.com`). See `EMAIL_SMS_SETUP.md`. |
| **SMTP option (alternate to Resend)** | If Aaina wants to send via raw SMTP using `hr@qualityonecare.com`'s App Password instead of an API provider, ask the next session to add SMTP transport. Needs: App Password (NOT the mailbox password) + SMTP host/port. Currently the code doesn't support raw SMTP. |
| **Alerts card "doesn't navigate"** | Asked diagnostic questions, never got answers. After merge, click the card once and report: did the URL change? Does the Due card next to it work? Does the bell icon top-right work? |
| **License Watch / Excel upload** | When Aaina uploads an Excel for license tracking, the engine doesn't fire as expected. Need her to paste what the Excel Monitor panel shows after upload. |
| **"Beautiful experience" beyond what shipped** | Vague — needs a specific page that still feels plain. |
| **"Remove unnecessary processes"** | Vague — needs one example (e.g. "Excel Monitor we don't use"). |
| **Step 14 Application Updates** | Skipped because there's no flag yet for "existing employee". Needs Aaina to define the trigger before it can be built. |

## Important context the next session must know

### Aaina's preferences (from memory + this session)

- **No complications.** Pick a default, ship a slice, don't enumerate options. She's a non-engineer and gets fatigued by long option lists.
- **One thing at a time.** When she asks for a feature, build it focused. Then ship + ask what's next.
- **Production data is real.** She has a real applicant (Fatmata Jatta) on the system. Don't run destructive ops without explicit confirmation in the chat.
- **She owns the merge button.** Push to the PR branch, do NOT merge directly to `main`. She will click Merge when she's ready to batch.

### Apps inventory (don't confuse the two)

- **HR Portal** (this repo) — `quality-one-care-hr-portal` — Aaina's HR app, lives at `https://quality-one-care-hr-portal-production.up.railway.app`
- **HRCC** (separate repo) — different app, don't mix them up

### Aaina's identity

- Email: `aaina@qualityonecare.com` (her personal work account — NEVER set as EMAIL_FROM)
- Role: `super_admin_hr`
- The Danger Zone cleanup tool will ensure she stays as super_admin_hr

### Other identities

- `hr@qualityonecare.com` — official HR department mailbox. Default sender for all outbound mail.
- `info@qualityonecare.com` — public-facing contact (used in error pages, AuthPanel)
- `qualityonecare39@gmail.com` — the agency Gmail used to log into the CJIS Google Form. Configurable via `CJIS_LOGIN_EMAIL` env var, default hardcoded.

### Railway service

- Project: `3be20885-a9dd-4579-806d-71047fbb5ff2`
- Service: `f68d3b8b-7fc4-4dbf-b150-e740dbd2a80e`
- Direct: https://railway.com/project/3be20885-a9dd-4579-806d-71047fbb5ff2/service/f68d3b8b-7fc4-4dbf-b150-e740dbd2a80e
- Live URL: https://quality-one-care-hr-portal-production.up.railway.app
- **Important:** `RESET_ADMIN_PASSWORD` env var is still set. Every deploy resets Aaina's password to whatever's in that var. Once she's logged in stably, she should delete that env var. Already documented in earlier handoffs.

### Working directory

- Aaina's local: `C:\Users\honpa\Documents\quality-one-care-hr-portal`
- Active worktree: `.claude/worktrees/loving-brahmagupta-0daecc`
- Auto-loaded memory at: `~/.claude/projects/C--Users-honpa-Documents-quality-one-care-hr-portal/memory/`

## Recipe for the next session

1. **Read this file.** Don't ask for context — it's all here.
2. **Check git log:** `git log --oneline main..HEAD` to see exactly what's pending merge.
3. **Wait for Aaina's next ask.** Don't proactively merge or change deployment state.
4. **When she gives you a fix:** push to the same branch (`claude/loving-brahmagupta-0daecc`), don't open a new PR.
5. **Run typecheck before every commit:** `npx tsc --noEmit` — must be clean.
6. **No `npx next build` locally** — it fails on missing env vars (no `DATABASE_URL`/`AUTH_SECRET` locally). That's expected. Compile-only check happens via tsc.
7. **When she says "merge":** point her at the compare URL. She clicks Merge. Don't push to main directly.

## File locations cheat sheet

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Intake wizard pages: `app/applicant/intake/`
- Intake step components: `components/applicant/intake/`
- Intake schemas: `services/intake/`
- Verification: `services/verification/verificationService.ts`, `services/verification/verificationLinks.ts`, `services/verification/verificationAssistantService.ts`
- HR pages: `app/hr/`
- Admin pages: `app/admin/`
- DON pages: `app/don/`
- Email/SMS: `services/notifications/emailService.ts`, `services/notifications/applicantStatusNotifier.ts`, `services/notifications/smsGateway.ts`, `services/notifications/credentialDeliveryService.ts`
- Auth: `lib/auth.ts`, `middleware.ts`, `app/api/auth/`
- Address: `app/api/address/suggest/route.ts`, `components/AddressAutocomplete.tsx`
- Identity match: `app/api/applicant/identity-snapshot/route.ts`, `components/IdentityMatchBadge.tsx`
- Date helpers: `lib/dates.ts`

## Last words

Aaina is sending out application links to real applicants soon. The first one's account is **Fatmata Jatta**, application ID `cmou6504n0029o83wxojngpq9`, currently in `verification_in_progress`. Her existing data must not be lost — the Danger Zone cleanup tool already preserves applicants with non-draft applications, so it's safe.

Be patient and concrete. Aaina is exhausted but motivated. Ship one focused thing at a time, point her at the merge button, ask what's next.
