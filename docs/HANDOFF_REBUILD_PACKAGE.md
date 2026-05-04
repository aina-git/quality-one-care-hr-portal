# Quality One Care Rebuild Package

## Purpose

This handoff package is for rebuilding the Quality One Care HR Operations Portal to a higher standard. It includes the current source code archive, the intended architecture, and the exact workflow specification.

The rebuild should not copy the weak parts of the current user experience. It should preserve the useful data model and service ideas, but rebuild the operational experience around the workflow in `docs/HANDOFF_ARCHITECTURE_AND_WORKFLOW.md`.

---

## Local App Folder

Local project folder:

`C:\Users\honpa\Documents\New project`

Source archive created for handoff:

`C:\Users\honpa\Documents\New project\handoff\quality-one-care-source-handoff.zip`

---

## What Is Included in the Source Archive

Included:

- `app/`
- `components/`
- `lib/`
- `prisma/`
- `public/` source assets except uploaded applicant files.
- `scripts/`
- `services/`
- `types/`
- `middleware.ts`
- `next.config.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `.env.example`
- Tailwind, TypeScript, and PostCSS configuration.
- OCR language data file if present.
- Handoff docs.

Excluded intentionally:

- `.env` because it may contain local secrets.
- `node_modules/` because dependencies should be installed with `npm install`.
- `.next/` because it is generated build output.
- `.git/` because it is repository metadata.
- `storage/`, `public/uploads/`, and `backups/` because those may contain applicant documents or private data.
- Local dev logs and runtime files.

---

## Current Tech Stack

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- Prisma ORM.
- PostgreSQL.
- bcrypt password hashing.
- Session/JWT-style auth helpers.
- Local protected file storage.
- Provider-ready OCR/document analysis/email/SMS/WhatsApp.

---

## Setup Commands

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Build command:

```bash
npm run build
```

QA command added:

```bash
npm run qa:workflow
```

---

## Environment Variables Needed

Use `.env.example` as the starting point. Do not reuse local `.env` blindly.

Core:

```env
DATABASE_URL=
SESSION_SECRET=
```

OCR and analysis:

```env
OCR_PROVIDER=local
OCR_API_KEY=
AI_PROVIDER=
AI_API_KEY=
DOCUMENT_ANALYSIS_PROVIDER=none
DOCUMENT_ANALYSIS_CONFIDENCE_THRESHOLD=0.90
LOCAL_DOCUMENT_ANALYZER_URL=http://localhost:8000/analyze
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=
GROQ_API_KEY=
GROQ_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

Messaging:

```env
EMAIL_PROVIDER=
EMAIL_API_KEY=
EMAIL_FROM=
SMS_PROVIDER=
SMS_API_KEY=
SMS_FROM=
WHATSAPP_PROVIDER=
WHATSAPP_API_KEY=
WHATSAPP_FROM=
```

Storage:

```env
STORAGE_PROVIDER=local
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

---

## Known Product Failures to Avoid in Rebuild

These are the main reasons the current app did not feel operationally complete:

1. The UI became feature-heavy but not workflow-clear.
2. The Super Admin dashboard did not initially show meaningful action queues.
3. Applicant and Admin status views became disconnected in earlier iterations.
4. Final verification pages existed before the workflow made it obvious what HR should do first.
5. OCR and machine-learning-assisted extraction were not strong enough to replace human review.
6. Low-confidence extracted fields created confusing missing-data flags.
7. The system sometimes pushed work onto Super Admin instead of clearly showing automated processing results and next action.
8. Document preview initially opened a JSON signed-url response instead of a direct viewer experience.
9. The user interface did not consistently feel like a polished healthcare operations product.

The rebuild must prioritize:

- One shared lifecycle source of truth.
- Clear queues.
- Clear next action.
- Document preview beside extracted data.
- Machine-learning-assisted suggestions with confidence, never guessing.
- DON as final approval authority.
- Practical verification workspace, not just static pages.

---

## Rebuild Acceptance Criteria

The rebuilt app should pass these checks before being considered acceptable:

### Authentication and Roles

- Unauthenticated users are redirected to login.
- Applicant cannot access HR/Admin/DON pages.
- Super Admin never falls into Applicant layout.
- DON can approve but cannot manage users.
- CEO is read-only.
- Scheduler sees approved applicants only.

### Applicant Workflow

- Applicant creates account with required identity photo.
- Applicant starts an application before upload.
- Applicant can choose digital or paper/scanned intake.
- Uploads attach to an application.
- Applicant sees simple progress and requested actions.

### Intake and OCR

- Scanned PDF/image uploads are OCR processed locally when possible.
- Documents are classified into application form, resume, license, CPR, ID, medical, training, background, or other.
- Confidence is stored per field.
- Low-confidence fields are flagged, not autofilled.
- Extracted data is shown with source document.

### HR Review

- Submitted applications immediately appear in HR/Admin queue.
- HR can open review, review documents, resolve issues, message applicant, rerun review, reject, hold, or pass to verification.
- Every action logs status history and audit record.

### Verification

- HR can complete final verification checklist.
- External verification instructions are shown for each credential.
- Evidence can be uploaded and attached.
- Critical blockers prevent DON submission.

### DON Approval

- DON queue shows ready cases.
- DON final page shows full compliance package.
- DON can approve, reject, or return for correction.
- Final decision is human-only.

### Operations

- Notifications are visible and useful.
- Tasks and reminders are created by workflow.
- Calendar and messaging are role-aware.
- Build passes.
- QA script passes.

---

## Suggested Rebuild Approach

1. Rebuild authentication and layouts first.
2. Build one lifecycle/status service before dashboards.
3. Build Applicant intake with application creation locked before uploads.
4. Build document storage and preview.
5. Build OCR/classification/extraction with confidence model.
6. Build validation and issue queue.
7. Build HR review workspace.
8. Build verification workspace.
9. Build DON approval package.
10. Add dashboards, tasks, notifications, messages, and calendar.
11. Add analytics, exports, audit review, and system health last.

Do not start with dashboards. Dashboards should be summaries of real workflow data, not decorative pages.

