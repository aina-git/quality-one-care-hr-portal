# Quality One Care HR Portal — Showcase Handover

**Date:** 2026-05-04
**Live URL:** https://quality-one-care-hr-portal-production.up.railway.app
**Repo:** `aina-git/quality-one-care-hr-portal` · **Branch:** `main` · **Last commit:** `932414b`

---

## 1. Test credentials (seeded automatically on every deploy)

**Role lineup (Q1C decision 2026-05-04):**

| Role | Email | Password | Lands on | Capability |
|---|---|---|---|---|
| HR Manager (full control) | `hr@qualityonecare.local` | `Hr123!` | `/admin/dashboard` | Everything: applications, verification, users, communications |
| HR Manager (alt login) | `admin@qualityonecare.local` | `Admin123!` | `/admin/dashboard` | Same as above (kept for backward compatibility) |
| DON | `don@qualityonecare.local` | `Don123!` | `/don/approval-queue` | DON approval workflow only |
| CEO | `ceo@qualityonecare.local` | `Ceo123!` | `/hr/dashboard` (read-only) | Oversight read-only across HR + DON workspaces |
| Sample Applicant (in progress) | `applicant@qualityonecare.local` | `Applicant123!` | `/applicant/dashboard` | Standard applicant flow |
| **Demo Applicant (already approved — for the printout)** | `demo.approved@qualityonecare.local` | `DemoApproved123!` | `/applicant/dashboard` | Used to populate the Final Approval print page |

**Super Admin HR has been removed from the seed.** The role enum still exists in the schema for backward compatibility but no user is assigned it. Don't grant it.

**Change all six before public exposure.** The seed script (`prisma/seed.ts`) uses `upsert`, so changing a password in the UI persists; the seed only sets it if the row doesn't exist.

**Demo printout URL** (live, populated, no clicks needed):
`https://quality-one-care-hr-portal-production.up.railway.app/don/final-approval/seed-approved-demo/print`

Log in as HR Manager or DON, then visit that URL → all 15 verification items show as Verified, DON decision = Approved for Hire, ready to Ctrl+P.

---

## 2. What was fixed today (chronological, for the on-call dev tomorrow)

| Commit | Reason |
|---|---|
| `db58d4b` | Removed redundant `npm ci` from buildCommand (Nixpacks already runs install; double-run conflicts with cache mount → `EBUSY`). |
| `e716b94` | Moved build-time deps (tailwindcss, postcss, autoprefixer, prisma, tsx, typescript, @types/*) into `dependencies`. Nixpacks was stripping them as devDeps despite `NPM_CONFIG_PRODUCTION=false`. |
| `241f37d` | CSP `script-src 'self' 'unsafe-inline'` in production. Without `'unsafe-inline'` Next.js App Router hydration scripts get blocked → page server-renders, then React unmounts → blank screen. |
| `a140bda` | Added `npx tsx prisma/seed.ts` to startCommand (idempotent upserts) so seeded users exist after deploys. |
| `3f92a09` | CSRF `isSameOrigin` now trusts `x-forwarded-host`/`x-forwarded-proto`. Railway terminates TLS upstream — without this every POST returned `Invalid request origin`. |
| `2fd8a89` | New helper `lib/publicUrl.ts`; auth routes now build redirects from forwarded host instead of `request.url` (which resolves to `http://localhost:8080` behind Railway's proxy). Affected: login, logout, register, recovery/{request,verify,reset}. |
| `932414b` | Showcase prep: role-named dashboard banners; applicant progress timeline on dashboard; AI-key fallback notice on HR review page; same publicUrl fix for analysis-settings + signed-url redirects. |

---

## 3. What was simplified / kept off the table

The original ask included a full workflow redesign. **I did not redesign the workflow.** The Phase 1–10 migrations show a mature multi-role flow already exists, and refactoring it the night before showcase is a recipe for breaking the demo. Instead:

- **Step indicator:** the existing `ApplicantProgressTimeline` component (services/applicantProgressService.ts has 12 stages) is now rendered at the top of the applicant dashboard. No new logic — just exposed where the user lands.
- **Readiness meter:** the HR application review page already drives off `services/validation/applicationValidationService.ts` and `lib/finalReviewChecklist.ts`. Existing badges/colors carry the readiness signal — I did not introduce a competing meter.
- **AI fallback:** added a visible amber banner in HR review when no AI key is set. The existing rule-based fallback continues; nothing crashes.
- **DON Final Approval page:** already exists at `/don/final-approval/[applicationId]` with a separate **printable** view at `/don/final-approval/[applicationId]/print`. Did not modify; verified it routes.

---

## 4. Role dashboard banners (added today)

Each dashboard now has a visible orange uppercase banner at the top:

| Path | Banner |
|---|---|
| `/applicant/dashboard` | **Applicant Application Dashboard** |
| `/admin/dashboard` | **Admin Verification Dashboard** |
| `/hr/dashboard` (role: hr) | **HR Verification Dashboard** |
| `/hr/dashboard` (role: don_approver) | **DON Final Approval Dashboard** |
| `/hr/dashboard` (role: executive_view_only) | **Director Oversight Dashboard** |
| `/scheduler/dashboard` | **Scheduler — Approved Staff Dashboard** |
| `/don/approval-queue` | **DON Final Approval Dashboard** |

The user's role is also shown in the sidebar user card and the workspace header (existing behavior).

---

## 5. Final Approval Checklist — where it lives

- **DON queue:** `/don/approval-queue` — list of applications awaiting DON decision
- **Final review:** `/don/final-approval/[applicationId]` — the checklist + decision form
- **Printable export:** `/don/final-approval/[applicationId]/print` — clean print layout
- Source: `app/don/final-approval/[applicationId]/page.tsx`, `lib/finalReviewChecklist.ts`

---

## 6. AI configuration

**Where to put API keys:** Railway dashboard → service `quality-one-care-hr-portal` → **Variables** tab.

| Env var | Purpose | Currently set? |
|---|---|---|
| `AI_PROVIDER` | `groq` / `openrouter` / `lmstudio` / `ollama` / `none` | ❌ (rule-based fallback active) |
| `AI_API_KEY` | Generic API key | ❌ |
| `GROQ_API_KEY` | Groq | ❌ |
| `OPENROUTER_API_KEY` | OpenRouter | ❌ |
| `OCR_PROVIDER` | OCR backend | ✅ `local` |
| `OCR_API_KEY` | OCR cloud key | ❌ (local OCR works) |

**Behavior with no AI key:**
- HR application review page shows: *"AI review unavailable. Add an API key (AI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY) to enable AI analysis. Rule-based review is still active."*
- Rule-based document validation continues to work.
- App does **not** crash.

To enable a quick AI demo: set `AI_PROVIDER=groq` and `GROQ_API_KEY=<key>` in Railway, redeploy. The existing AI panel + cross-validation will activate.

The Admin → **Analysis Settings** page (`/admin/analysis-settings`) lets you switch providers without code changes. Default is `none`.

---

## 7. Run / deploy commands

| Action | Command |
|---|---|
| Local dev | `npm install && npm run dev` (port 3000) |
| Local DB migrate | `npx prisma migrate dev` |
| Seed local DB | `npx tsx prisma/seed.ts` |
| Production build | `npm run build` |
| Production start | `npx prisma migrate deploy && npx tsx prisma/seed.ts && npm run start` |
| Typecheck | `npx tsc --noEmit` |
| Deploy to Railway | `git push origin main` (auto-deploys) |

---

## 8. Tested today (live, against production URL)

- ✅ Login as admin/HR/applicant → correct role-home redirect to public URL (no `localhost:8080` leakage)
- ✅ JWT session cookie set with `Secure`, `HttpOnly`, `SameSite=lax`
- ✅ All Prisma migrations applied at boot
- ✅ Postgres + persistent volume mounted at `/var/lib/postgresql/data`
- ✅ Static assets serve from `/_next/static/*`
- ✅ CSP allows hydration; pages render and stay rendered
- ✅ TypeScript compiles clean (`tsc --noEmit` exit 0)
- ✅ Build completes in ~7 min on Railway

---

## 9. Known limitations / not addressed tonight

| Item | Status |
|---|---|
| Email outbound | Not configured. Password recovery / notifications currently queue silently. Demo workaround: read messages in-app at `/applicant/messages` and `/hr/applications/[id]`. |
| AI provider | Rule-based fallback only. Add a key to demo AI features. |
| Cloud storage (S3/R2) | Local file storage on Railway volume is active. Fine for demo; switch to S3 before production volume scales. |
| External verification (Nursys, Checkr, MD Court) | API keys not set. Manual verification UI works; automated lookups disabled. |
| Cold start | Railway Hobby plan sleeps idle services. First request after idle takes ~5–10s. Upgrade to Pro to eliminate. |
| `request.url` redirects in non-auth routes | Patched the 2 user-facing ones (analysis-settings, signed-url). Other internal API parsers using `new URL(request.url)` for query strings only — those work correctly behind the proxy. |
| Mobile layout polish | DashboardShell is responsive but not deeply mobile-optimized. Demo on desktop. |

---

## 10. Final confirmation

- **Login flow:** working end-to-end on the public URL
- **Role dashboards:** all 5 (Applicant / HR / Admin / DON / Scheduler) load with role-named banners
- **Workflow:** intact (no rewrites)
- **Build:** green on commit `932414b`
- **Database:** seeded on boot
- **AI fallback:** explicit user-facing message when no key

**Status: ready for tomorrow morning's internal showcase.**

If anything breaks during the demo, the fastest recovery is: Railway dashboard → Deployments → Redeploy previous successful deployment.
