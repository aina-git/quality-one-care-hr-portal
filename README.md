# Quality One Care - HR Application Portal

Production-ready HR application portal foundation for Quality One Care, a home health care agency specializing in pediatric care, skilled nursing, therapy services, and adult care.

## Phase 1 Features

- Branded landing, login, register, applicant, HR, and admin pages
- Full-width logo header on every page
- Applicant self-registration only
- Email/password login with bcrypt password hashing
- Signed session cookie authentication
- Role-based access control for applicant, HR, and admin areas
- PostgreSQL schema with Prisma ORM
- Seeded Admin and HR users
- Applicant dashboard and application section shell
- HR dashboard excluding draft applications
- Admin dashboard and user management table
- Audit log helper: `logAction(userId, action, entityType, entityId, details)`

## Phase 2 Features

- Applicant document upload for Resume, Scanned Application Form, License, CPR Certificate, Training Certificate, Reference Document, and Other Supporting Document
- Local development file storage in `/public/uploads`
- Upload validation for PDF, PNG, JPG, JPEG, DOCX, and 10MB maximum file size
- Document processing jobs with pending, processing, completed, and failed states
- Provider-ready OCR service structure with local fallback extraction
- Rule-based document classification for resume, application form, license, CPR certificate, training certificate, reference document, and other
- Rule-based extracted field storage for personal information, employment history, pediatric experience, licenses, certifications, and references
- Applicant intake review page for accepting, correcting, rejecting, and manually entering fields
- Mapping service that applies confirmed fields into draft application sections without repeatedly creating duplicate records
- Applicant-facing validation gate with blocking and warning issues
- Submit application gate that keeps applications in `draft` until blocking issues are resolved
- HR dashboards continue to exclude draft applications
- Audit logging for upload, processing, field review, validation, and submission actions

## Phase 3 Features

- HR/Admin-only Machine-learning-assisted review workflow for submitted applications
- Review trigger route: `POST /api/hr/applications/:id/run-review`
- HR review page: `/hr/applications/[id]/review`
- Rule-based fallback review engine when `AI_PROVIDER` and `AI_API_KEY` are not configured
- Provider-ready AI structure for future enhancement without hardcoded keys
- Complete application snapshot service for application data, documents, extractions, extracted fields, and validation issues
- Discrepancy review for employment, license, document consistency, corrected extracted fields, and supporting evidence
- Pediatric experience review with evidence sources, estimated years, strength level, concerns, and summary
- License review for entered license data, expiration status, and document support
- Employment history review for employer count, date issues, pediatric relevance, possible gaps, and concerns
- Document review for detected document types, missing expected documents, low-confidence extraction, and failed processing
- Recommendation engine with risk level and HR action items
- Review findings stored in the database
- HR applications table shows review status, risk level, recommendation, and review action
- Audit logging for review start, completion, failure, rerun, and report view

The review report always displays: `Machine-learning-assisted review. Final approval must be completed by the authorized DON reviewer.`

## Phase 4 Features

- HR/Admin decision workflow on the HR review page
- HR decisions stored with source status, target status, note, author, and timestamps
- Application status history for applicant submission, correction resubmission, and HR decisions
- Applicant-visible in-app messages for clarification requests
- Internal HR notes that are never shown to applicants
- Interview record foundation created when HR chooses Proceed to Interview
- Applicant correction workflow with dashboard and messages visibility
- Applicant resubmission after correction when validation passes
- HR applications table filters for application status, review status, and risk level
- Phase 4 audit logs for decisions, clarification requests, interview record creation, internal notes, and resubmission

HR decision status mapping:

- `proceed_to_interview` -> `ready_for_interview`
- `request_clarification` -> `correction_requested`
- `place_on_hold` -> `under_review`
- `mark_not_selected` -> `rejected`
- `approve_for_onboarding` -> `approved`

## Phase 5 Features

- Provider-ready email notification service with queue fallback when `EMAIL_PROVIDER` or `EMAIL_API_KEY` is not configured
- Message template system for clarification, interview, onboarding, and license alert messages
- HR/Admin interview scheduling, updating, and cancellation
- Applicant-only interview visibility through the applicant dashboard and applicant interview API
- Approval-triggered onboarding checklist creation
- HR/Admin onboarding checklist item updates
- Applicant onboarding progress visibility
- License expiration tracking for expired licenses and licenses expiring within 30 days
- License alerts stored as applicant-visible messages and queued email notifications
- HR dashboard widgets for queued emails, scheduled interviews, onboarding, expired licenses, expiring licenses, and open license alerts
- Phase 5 audit logs for queued email, messages, interview scheduling/cancellation, onboarding, and license alerts

## Phase 6 Features

- Middleware-based HTTP security headers
- CSRF protection for unsafe API methods
- Rate limiting on login, register, and document upload
- Protected local storage outside `/public` plus provider-ready S3/R2 storage service
- Strict file signature, MIME, and extension validation for uploads
- Public `/uploads` access blocked
- Signed and authorized document access routes
- Audit logs enriched with IP address, user agent, request path, and request id
- Admin audit viewer with filters and pagination at `/admin/audit`
- Centralized safe API error handling with structured server logs
- Real provider email delivery support for Resend and SendGrid
- Backup/export script for users, applications, and audit logs
- Dashboard loading states and error boundaries for applicant, HR, and admin sections
- Pagination for applications, messages, and audit logs
- Environment validation with startup warnings for missing optional providers
- Compliance disclaimer banner for HR/Admin workspaces

## Phase 7 Features

- Background job runner with database-backed job definitions, execution logs, safe locking, and retry-aware runs
- Scheduled jobs for daily license monitoring, five-minute message queue processing, application inactivity reminders, and pending HR review reminders
- Applicant message retry tracking with queued email retry processing up to three attempts
- HR in-app operational alerts with `critical`, `high`, and `normal` prioritization
- Admin analytics dashboard at `/admin/analytics`
- Admin system health dashboard at `/admin/system-health`
- Advanced HR application filters for pediatric strength, risk, license status, application age, and latest decision
- HR bulk actions for reminders, mark-reviewed workflow, and selected-application exports
- CSV export services for applications, onboarding status, license status, and audit logs
- Daily automation for stale draft applications, stale correction requests, and overdue HR reviews
- Job execution, bulk action, and system-generated alert audit logging
- Protected auto-start job runner with environment toggles for deployment safety

## Phase 8 Features

- Final Employment Verification workflow after HR approval for onboarding
- Auto-created `FinalVerificationChecklist` with required verification categories
- Manual HR/Admin verification entry for employment history, professional verifications, character reference, CGIS/background receipt, OIG, Maryland Case Search, Nursys, Maryland Board of Nursing, physical health form, TB/chest X-ray, NSO liability insurance, CPR, ID/work authorization, sanitation training, and final decision
- Provider-ready external verification link structure for Maryland Board of Nursing, Nursys, Maryland Case Search, OIG, CGIS, NSO, and CPR checks
- CGIS receipt capture guidance for Quality One Care Home Health Inc. with MA Provider Number `420641000`
- HR verification page at `/hr/applications/[id]/verification`
- Admin-only DON final approval page at `/don/final-approval/[applicationId]`
- Printable/PDF-ready final approval report at `/don/final-approval/[applicationId]/print`
- DON approval blocked until all required items are verified or marked not applicable with notes
- Application status `final_not_approved` retained when DON/Admin records a not-approved final decision
- HR dashboard widgets for final verification progress, DON-ready checklists, returned checklists, and expired verification items
- Admin dashboard widgets for DON approval queue and verification completion rate
- Audit logging for checklist creation, item updates, evidence attachment, external verification records, DON views, DON decisions, and returned-for-correction workflow

Phase 8 remains a manual verification foundation. It does not call external license, background check, insurance, payroll, or signature APIs.

## Phase 9 Features

- Expanded governance roles: `super_admin_hr`, `don_approver`, `executive_view_only`, and `scheduler_limited`
- Inactive user support with login blocking for deactivated users
- HR-only user governance at `/admin/users` with create user, role assignment, role changes, and deactivate/reactivate controls
- DON approval permissions separated from HR intake and system administration permissions
- Executive view-only access for dashboards, applications, verification progress, and DON reports without write access
- Scheduler dashboard at `/scheduler/dashboard` limited to approved applicants
- Post-DON employee onboarding workflow using `EmployeeOnboarding` and `OnboardingTask`
- Default employee onboarding tasks: Review Employee Manual, Complete Compliance Training, Complete Pediatric Care Training, Complete KanTime Training, and Submit required onboarding documents
- HR employee onboarding page at `/hr/onboarding/[id]`
- Applicant onboarding page at `/applicant/onboarding`
- Rule-based training recommendation service at `/services/training/trainingRecommendationService.ts`
- Training recommendations for KanTime onboarding, pediatric basics, G-tube care, tracheostomy care, seizure management, behavioral support, infection control, documentation training, and CPR readiness
- HR training dashboard at `/hr/training`
- Audit logging for role creation/update, user role changes, onboarding creation, onboarding task completion, training recommendations, and scheduler access

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui-style local components
- Prisma ORM
- PostgreSQL
- bcryptjs
- jose signed session cookies
- pdf-parse and mammoth for local fallback text extraction

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Set environment variables:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quality_one_care_hr"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OCR_PROVIDER=
OCR_API_KEY=
AI_PROVIDER=
AI_API_KEY=
EMAIL_PROVIDER=
EMAIL_API_KEY=
EMAIL_FROM="hr@qualityonecare.com"
JOB_RUNNER_ENABLED=true
JOB_RUNNER_POLL_SECONDS=60
STORAGE_PROVIDER=local
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_ENDPOINT=
```

`OCR_PROVIDER`, `OCR_API_KEY`, `AI_PROVIDER`, `AI_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, and `STORAGE_SECRET_KEY` are provider variables. Do not commit real keys.

4. Run Prisma migration:

```bash
npm run prisma:migrate -- --name init
```

5. Seed Admin and HR users:

```bash
npm run prisma:seed
```

6. Start development server:

```bash
npm run dev
```

## Upload Folder

Protected uploaded documents are stored locally for development in:

```text
/storage/protected
```

This directory is outside the public web root. Middleware blocks direct `/uploads/*` access.

## Login Credentials

Admin:

- Email: `admin@qualityonecare.local`
- Password: `Admin123!`

HR:

- Email: `hr@qualityonecare.local`
- Password: `Hr123!`

Sample Applicant:

- Email: `applicant@qualityonecare.local`
- Password: `Applicant123!`

Applicants may also self-register at `/register`.

## Protected Routes

- Applicant: `/applicant/dashboard`, `/applicant/application`, `/applicant/intake-review`, `/applicant/messages`
- HR: `/hr/dashboard`, `/hr/applications`, `/hr/applications/[id]/review`
- Admin: `/admin/dashboard`, `/admin/analytics`, `/admin/system-health`, `/admin/users`, `/admin/audit`

Unauthorized users are redirected to their role dashboard or login page.

## OCR Fallback

Phase 2 does not require a paid OCR provider to run locally.

- Text-based PDFs are parsed locally where possible.
- DOCX files are parsed locally where possible.
- Image/scanned files return: `OCR provider not configured. Manual review required.`
- Fallback confidence is intentionally low so applicants know manual review may be needed.

## Validation Gate

Application status remains `draft` until the completion gate passes and the applicant submits. Submission is blocked when required data is missing, required documents are absent, OCR failed for required information, or extracted fields still need applicant confirmation.

HR dashboards continue to show only submitted or later applications.

## Screening Review Workflow

The review engine runs only when:

- `application.status = submitted`
- no blocking validation issues exist
- required fields are complete
- all extracted fields have been resolved by the applicant

Applicants cannot access HR review reports or review APIs. HR and Admin users can open `/hr/applications`, click `View Review`, and run or rerun the review.

When no AI provider is configured, the system uses `rule_based_engine`. If `AI_PROVIDER` and `AI_API_KEY` are configured later, the service structure is ready for provider-backed enhancement.

## Recommendation Logic

- `proceed_to_interview`: pediatric evidence is strong/moderate, no critical findings, license is not expired, and application is complete.
- `request_clarification`: useful applicant profile, but discrepancies, unclear license fields, missing support, or date conflicts need clarification.
- `hold_for_review`: serious but not conclusive issues require HR attention.
- `not_recommended_at_this_stage`: no pediatric evidence, expired license for licensed role, major contradictions, or critical findings.

## Risk Level Logic

- `low`: no critical findings and only minor warnings.
- `moderate`: some concerns, but application may proceed with HR review.
- `high`: critical issue or multiple major concerns.
- `incomplete_review`: required review inputs are missing or processing failed.

## HR Decision Workflow

HR and Admin users can create decisions from `/hr/applications/[id]/review`. A decision requires a note and cannot be created for draft applications.

Clarification requests create an applicant-visible message and move the application to `correction_requested`. Applicants can view the message at `/applicant/messages`, update their application or intake review, and resubmit only after validation has no blocking issues.

Proceed to Interview creates a pending `InterviewRecord` foundation only. The app does not send SMS, WhatsApp, or email, and does not integrate with calendars or onboarding packets.

## Email Notifications

Phase 5 does not require a production email provider. When `EMAIL_PROVIDER` or `EMAIL_API_KEY` is missing, notifications are stored in `EmailQueue` with `queued` status and can be sent later by a provider integration. Applicant-facing notification content is also stored in `ApplicantMessage`.

Supported Phase 6 providers:

- `resend`
- `sendgrid`

## Background Jobs

Phase 7 starts a protected background job runner from the server runtime. Jobs are stored in `JobDefinition` and each execution is recorded in `JobRun`.

Current schedules:

- `license_expiration_scan`: daily
- `message_queue_processor`: every 5 minutes
- `application_inactivity_checker`: daily
- `pending_review_reminder`: daily

Safety controls:

- database-backed job locks prevent duplicate execution across processes
- `JOB_RUNNER_ENABLED=false` disables startup scheduling
- `JOB_RUNNER_POLL_SECONDS` controls how often the runner checks for due work
- queued emails retry up to 3 times before remaining in `failed`

Admins can review status and manually trigger runs from `/admin/system-health`.

## Analytics and System Health

- `/admin/analytics` shows application conversion rates, average time to decision, rejection reasons, license expiration trends, and HR performance metrics.
- `/admin/system-health` shows job runner status, last execution times, failed run counts, queue status, storage usage, and prioritized operational alerts.
- `/hr/dashboard` includes prioritized alerts, overdue review counts, stale application counts, and failed job visibility for operations staff.

## HR Bulk Actions and Search

The HR applications page supports:

- advanced filters for pediatric evidence strength, review risk, license status, application age, and decision type
- bulk reminder messages
- bulk mark-reviewed updates for submitted applications
- selected application CSV export

Bulk reminder content uses message templates and is stored in both `ApplicantMessage` and `EmailQueue`.

## Interview Scheduling

HR and Admin users can schedule, update, and cancel interviews from `/hr/applications/[id]/review`. Scheduling and updates create applicant messages and queued email notifications. Applicants can view interview details but cannot modify them.

## Onboarding Checklist

When HR/Admin chooses `approve_for_onboarding`, the application moves to `approved` and an onboarding checklist is automatically created. HR/Admin users can update checklist item status. Applicants can view onboarding progress from the applicant dashboard.

## License Alerts

License alerts detect:

- expired licenses
- licenses expiring within 30 days

Alerts are stored in `LicenseAlert`, surfaced as applicant-visible messages, and queued for email delivery when no provider is configured.

Phase 7 escalation adds:

- `expiring_30_days`
- `expiring_7_days`
- `expired`

Operational dashboards also classify alerts by priority so HR can focus on urgent work first.

## Security Hardening

- Security headers are added through middleware.
- CSRF protection is enforced for unsafe API calls.
- Rate limiting protects login, registration, and upload routes.
- Uploaded files are validated by MIME type, extension, and file signature.
- Protected document access requires authorization and signed access URLs.
- Audit logs now include user, IP address, user agent, request path, and request id.
- No protected characteristics are used in review logic, and automatic rejection logic is not introduced.

## Audit Viewer

Admins can review audit activity at `/admin/audit` with:

- user email filter
- action filter
- date range filter
- paginated results

## Backup Instructions

Run:

```bash
npm run backup
```

This creates timestamped JSON exports in `/backups` for:

- `users`
- `applications`
- `audit logs`

## Deployment Steps

1. Set production environment variables.
2. Configure `STORAGE_PROVIDER` for local development or S3/R2 for production.
3. Configure `EMAIL_PROVIDER`, `EMAIL_API_KEY`, and `EMAIL_FROM` if live email delivery is required.
4. Decide whether the built-in job runner should start automatically and set `JOB_RUNNER_ENABLED`.
5. Run `npx prisma generate`.
6. Run `npx prisma migrate deploy`.
7. Run `npm run build`.
8. Start with `npm run start`.

## Production Checklist

- `AUTH_SECRET` is long and unique.
- PostgreSQL credentials point to the target environment.
- Email provider credentials are configured if live delivery is required.
- Storage provider credentials are configured if cloud storage is enabled.
- Job runner settings are confirmed for the target environment.
- Backups are tested with `npm run backup`.
- Build passes before release.
- Public `/uploads` access remains blocked.
- Admin-only audit access is verified.

## Project Structure

```text
/app
/components
/lib
/prisma
/types
/services
/public
```

## Logo

The application expects the company logo at:

```text
/public/logo.png
```

## Phase 2 Testing Steps

1. Login as an applicant.
2. Open `/applicant/application`.
3. Upload valid PDF, PNG/JPG/JPEG, and DOCX documents below 10MB.
4. Confirm invalid file types are rejected.
5. Confirm files over 10MB are rejected.
6. Open `/applicant/intake-review`.
7. Confirm uploaded documents show detected type, confidence, and processing status.
8. Accept, correct, and reject extracted fields.
9. Add missing information through Manual Entry.
10. Open `/api/application/validation` while logged in as applicant to inspect validation JSON.
11. Confirm submission is blocked while blocking issues remain.
12. Resolve blocking issues and submit.
13. Login as HR and confirm draft applications are hidden and submitted applications appear.
14. Login as Admin and confirm admin access still works.

## Phase 3 Testing Steps

1. Login as HR and confirm `/hr/applications` shows submitted applications only.
2. Open `/hr/applications/[id]/review`.
3. Trigger review as HR.
4. Trigger review as Admin.
5. Confirm applicant cannot access `/hr/applications/[id]/review`.
6. Confirm draft applications cannot be reviewed.
7. Confirm applications with blocking validation issues cannot be reviewed.
8. Confirm report generation stores an `AIReviewReport`.
9. Confirm `ReviewFinding` records are stored.
10. Confirm risk level and recommendation display on the review page and applications table.
11. Confirm pediatric, license, employment, and document review sections appear.
12. Confirm Phase 1 auth and Phase 2 intake still work.
13. Run `npm run build`.

## Phase 4 Testing Steps

1. Login as HR or Admin.
2. Open `/hr/applications` and confirm draft applications are not listed.
3. Use table filters for status, review status, and risk level.
4. Open `/hr/applications/[id]/review`.
5. Save a decision with an empty note and confirm it is blocked.
6. Save `request_clarification` with a note and confirm the application moves to `correction_requested`.
7. Login as the applicant and confirm the correction request appears on the dashboard and `/applicant/messages`.
8. Confirm internal HR notes do not appear to the applicant.
9. Resolve validation issues and resubmit as the applicant.
10. Confirm resubmission returns the application to `submitted`.
11. Save `proceed_to_interview` as HR/Admin and confirm a pending interview record appears.
12. Confirm applicants cannot access HR decision routes or HR review pages.
13. Confirm Admin can access HR applications and create decisions.
14. Run `npm run build`.

## Phase 5 Testing Steps

1. Leave `EMAIL_PROVIDER` and `EMAIL_API_KEY` blank and trigger an applicant notification.
2. Confirm the notification is stored in `ApplicantMessage`.
3. Confirm the email is stored in `EmailQueue` with `queued` status.
4. Login as HR/Admin and open `/hr/applications/[id]/review`.
5. Schedule an interview and confirm the applicant can see interview details.
6. Update or cancel the interview and confirm the applicant receives a message.
7. Approve an application for onboarding and confirm the checklist is auto-created.
8. Update onboarding items as HR/Admin.
9. Login as the applicant and confirm onboarding progress appears.
10. Create or use expired/soon-expiring licenses and run `POST /api/hr/license-alerts`.
11. Confirm alerts are stored and applicant messages are created.
12. Confirm HR dashboard widgets display queued emails, interviews, onboarding, and license alert counts.
13. Confirm applicants cannot call HR-only scheduling, onboarding, or alert APIs.
14. Run `npx prisma generate`, `npx prisma migrate deploy`, and `npm run build`.

## Phase 6 Testing Steps

1. Confirm unauthorized access to applicant, HR, admin, and document APIs is blocked.
2. Confirm repeated invalid login attempts trigger `429` rate limiting.
3. Upload a valid document and confirm it is stored outside `/public`.
4. Upload an invalid file type and confirm a safe `400` error message.
5. Open `/uploads/...` directly and confirm access is blocked.
6. Request a signed document URL and confirm only authorized users can use it.
7. Confirm audit logs include IP address, user agent, and request path.
8. Confirm `/admin/audit`, `/hr/applications?page=1`, and `/applicant/messages?page=1` load successfully.
9. Trigger an expected API error and confirm the client receives a safe message while structured logs are recorded server-side.
10. Run `npm run backup` and confirm a timestamped backup directory is created.
11. Run `npx prisma generate`, `npx prisma migrate deploy`, and `npm run build`.

## Phase 7 Testing Steps

1. Run `npx prisma generate` and `npx prisma migrate deploy`.
2. Login as Admin and open `/admin/analytics`.
3. Login as Admin and open `/admin/system-health`.
4. Manually trigger `message_queue_processor` from `/admin/system-health` and confirm queued emails are processed when a provider is configured.
5. Leave the email provider blank and confirm queued emails remain queued instead of sending.
6. Trigger `license_expiration_scan` and confirm no duplicate license alerts are created for the same license and threshold.
7. Create stale draft and correction-requested applications, run `application_inactivity_checker`, and confirm reminder messages are created.
8. Create a submitted application older than 24 hours without a completed review, run `pending_review_reminder`, and confirm an HR operational alert appears.
9. Open `/hr/dashboard` and confirm prioritized alerts and automation widgets render.
10. Open `/hr/applications` and verify advanced filters for pediatric strength, risk, license status, age, and decision type.
11. Use HR bulk actions to send reminders, mark selected applications as reviewed, and export selected applications.
12. Export onboarding status, license status, and audit logs from Admin routes.
13. Confirm `/admin/system-health` shows job history, queue status, and storage usage.
14. Confirm audit logs capture job execution, bulk actions, and system alert creation.
15. Run `cmd /c npx tsc --noEmit` and `npm run build`.

## Phase 8 Testing Steps

1. Approve an application for onboarding from `/hr/applications/[id]/review`.
2. Confirm a final verification checklist is created and no duplicate checklist is created on repeated approval/create attempts.
3. Open `/hr/applications/[id]/verification` as HR/Admin.
4. Update checklist items with status, result, expiration date, reference/tracking number, notes, and evidence document.
5. Mark an item not applicable and confirm a note is required.
6. Confirm CGIS/background receipt guidance displays the agency name and MA Provider Number `420641000`.
7. Confirm applicants cannot access `/hr/applications/[id]/verification`, `/don/final-approval/[applicationId]`, or verification APIs.
8. Open `/don/final-approval/[applicationId]` as Admin.
9. Confirm final approval is blocked while required items are missing, expired, or failed.
10. Verify all required items or mark them not applicable with notes, then confirm DON approval is allowed.
11. Submit Returned for Correction and confirm checklist status updates.
12. Submit Not Approved and confirm the application status becomes `final_not_approved`.
13. Open `/don/final-approval/[applicationId]/print` and confirm the report is clean and print-ready.
14. Confirm HR/Admin dashboard verification widgets update.
15. Confirm audit logs capture Phase 8 actions.
16. Run `npx prisma generate`, `npx prisma migrate deploy`, and `npm run build`.

## Phase 9 Testing Steps

1. Login as Admin or Super Admin HR and open `/admin/users`.
2. Create users for `don_approver`, `executive_view_only`, and `scheduler_limited`.
3. Change a user role and confirm `user_role_changed` audit logging.
4. Deactivate a user and confirm login is blocked.
5. Confirm Executive can view dashboards and application/verification pages but cannot call write APIs.
6. Confirm DON can open final approval pages and submit DON decisions, but cannot manage users.
7. Confirm Scheduler can open `/scheduler/dashboard` and sees only applications with `approved` status.
8. Submit a DON approval and confirm `EmployeeOnboarding` and default `OnboardingTask` records are created.
9. Confirm training recommendations are generated for the application.
10. Open `/hr/onboarding/[id]` and update task completion.
11. Open `/applicant/onboarding` as the applicant and confirm applicant-visible tasks and training recommendations display.
12. Open `/hr/training` and confirm recommended, assigned, and completed training counts display.
13. Confirm access control for HR/Admin/DON/Executive/Scheduler/Applicant routes.
14. Run `npx prisma generate`, `npx prisma migrate deploy`, and `npm run build`.

## Future Roadmap

- Production OCR integration
- Advanced AI provider integration
- Interview readiness workflow
- Advanced audit reporting
- Phase 10 candidate communications and deeper workflow orchestration
