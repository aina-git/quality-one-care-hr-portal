# Quality One Care — End-to-End Demo Walkthrough

A guided tour through every stage of the application: applicant submits → HR reviews → automated verification → DON approval → onboarding.

**Time:** ~15 minutes
**Goal:** see and feel the entire workflow with realistic data.

---

## Setup (one time, ~30 seconds)

In PowerShell:

```powershell
cd "C:\Users\honpa\Documents\New project"

# Make sure the server is running (leave this window open):
npm run dev

# In a SECOND PowerShell window, prepare clean demo data:
npm run demo:setup
```

The setup script prints these credentials — keep this terminal visible:

| Role | Email | Password |
|---|---|---|
| **Demo Applicant** | `demo.applicant@qualityonecare.local` | `DemoApplicant123!` |
| **HR** | `hr@qualityonecare.local` | `Hr123!` |
| **Admin** | `admin@qualityonecare.local` | `Admin123!` |

You can re-run `npm run demo:reset` any time to start over with a clean demo applicant.

---

## Stage 1 — Applicant logs in and sees their dashboard

1. Open a fresh **incognito window**: http://localhost:3000/login
2. Log in as the **demo applicant**
3. You'll land on `/applicant/dashboard`

**What to notice:**
- "Welcome back" header with your name + completion %
- **6-step progress timeline:** Draft started → Submitted → HR Review → Verification → DON approval → Outcome (only "Draft started" is lit up — orange)
- **"What's next" banner:** suggests next action ("Continue application" or "Submit if ready")
- **Quick links grid:** Application form / Upload documents / Review extracted fields / Messages
- No alerts yet (this is a fresh applicant)

---

## Stage 2 — Walk through the application form

Click **"Application"** in the left sidebar (or the "Continue application" button).

You're now on `/applicant/application`. **Notice everything is pre-filled** — this is what a complete application looks like:

- **Section 1: Personal Information** — name, phone, DOB, MD address all filled
- **Section 2: Employment History** — 2 records (Mercy Children's Hospital + Sinai), first one tagged Pediatric
- **Section 3: Pediatric Experience** — radio buttons for "yes/no", years, duties textarea
- **Section 4: Licenses** — RN license R204815, MD, expires 2027
- **Section 5: Certifications** — BLS + PALS, both AHA, current
- **Section 6: References** — 2 references including a charge nurse supervisor
- **Section 7: Documents** — empty, will populate at next stage
- **Validation panel** at top showing completion percentage + any blocking issues
- **Submit button** at the bottom

**Try this:**
- Edit something (e.g., update the phone number) → click Save
- Watch the completion % update at the top in real time

---

## Stage 3 — Upload a document

Click **"Upload Documents"** in the sidebar.

You're at `/applicant/quick-upload`.

**Try this:**
- Upload any PDF or image (your driver's license, a resume — anything)
- Watch the document appear in the list with status "pending" → "processing" → "completed"
- The OCR engine will try to read it and extract fields

---

## Stage 4 — Review extracted fields

Click **"Review Extracted Fields"** in the sidebar.

You're at `/applicant/intake-review`.

**What you'll see:**
- Fields the OCR extracted, grouped into "needing review" + "already reviewed"
- Each field shows: extracted value, confidence %, source document, source snippet
- Three buttons per field: **Accept**, **Correct**, **Reject**
- A confidence < 90% means it asks the applicant to confirm

**Try this:** click Accept on a field → see it move to the "Already reviewed" collapsed section.

This is where the master plan rule ("never auto-fill low-confidence values") comes alive.

---

## Stage 5 — Submit the application

Back to **/applicant/application**.

Scroll to the bottom. The **Submit Application** button is enabled because all required sections are complete.

**Click Submit.**

**What happens autonomously:**
- Status flips from `draft` → `hr_review_pending`
- An HR review queue item is created
- An HR task is created
- A system alert is broadcast to HR
- 4 notifications fire
- Applicant dashboard timeline now lights up "Submitted" + greys "HR Review" as current

**Refresh `/applicant/dashboard`** to see the timeline change.

---

## Stage 6 — HR sees the queue and opens the review

1. **Log out** (sign out at bottom of sidebar)
2. **Log in as HR** (`hr@qualityonecare.local` / `Hr123!`)
3. You land on `/hr/dashboard`

**What to notice:**
- Big red **"Pending HR Review"** card at the top right with **"1"** in it (your demo applicant)
- HR Review Queue table shows the demo applicant
- "Recent activity" feed on the right shows the new submission

**Click the Open button** on the demo applicant's row in the queue.

You're now on `/hr/applications/[id]/review` — the HR review workspace.

**What to notice:**
- Header strip: applicant photo placeholder + name + role + status pill (now `hr_review_started` — opening the review auto-advances the status)
- **Run Review** button (top right) — this generates the AI verdict
- Left column: full case file (contact, employment, licenses, certifications, references, pediatric experience, documents)
- Right column: AI Review Verdict (currently empty), Open Issues (none), Recent Activity, HR Internal Notes

**Click "Run Review"** at the top right.

**What happens autonomously:**
- Rule-based AI engine analyzes the application
- Generates a verdict in seconds
- Right column populates with: Risk Level (likely Low/Moderate), Recommendation (likely "Proceed to Interview"), Strengths, Concerns

---

## Stage 7 — HR proceeds to verification

The verdict pane now shows recommendations. Suppose it recommends "Proceed to Interview" or "Approve for onboarding". For this demo, let's go directly to verification.

You'll need the application to be in `approved` status to start verification. Use the **Record HR Decision** panel at the bottom of the review page:
- Action: **Approve for onboarding**
- Note: "AI review passed. Strong pediatric background. Proceeding to verification."
- Click **Save Decision**

The page will reload and the status will be `approved`. The "Open Verification" button now appears.

**Click "Open Verification"** at the top right.

You're at `/hr/applications/[id]/verification` — the verification workspace.

**What to notice:**
- Header with completion % + missing/expired counts
- **Automated identity cross-check** panel (blue card near top) — click "Run cross-check" → see the consistency score across documents
- **Verification Checklist** with all 14 required items per master plan §10
- Each item shows: status badge, requirement, external link button, suggested matched documents, "Update item" disclosure

---

## Stage 8 — The autonomous OIG check (the headline feature)

Find the **"OIG Exclusion List"** row in the checklist.

You'll see a blue **"Automated verification"** box with a **"Run automated OIG check"** button.

**Click it.**

**What happens autonomously:**
- System downloads the latest LEIE dataset from oig.hhs.gov (~83,000 records, on first run)
- Searches for the demo applicant's name + DOB
- Updates the checklist item to `verified` (no match expected — Demo Nurse isn't a real person)
- Captures: timestamp, dataset version (`OIG-LEIE-2026-XX-XX`), verifier ID
- Audit trail logged

The row's status badge flips to **green "Verified"** with the result text "No match on OIG LEIE (checked 83,002 records, dataset updated YYYY-MM-DD)."

**This is real federal-level credential verification, autonomously, in milliseconds.**

---

## Stage 9 — Smart manual-lookup assistant for Nursys / MBON / etc.

Find the **"Maryland Board of Nursing"** row.

Each item that requires a manual lookup shows a **"Manual lookup helper"** panel:

**Step 1:** Click "Copy" — applicant's name + license number copied to your clipboard.

**Step 2:** Click "Open Maryland Board of Nursing" — the official MBON site opens in a new tab. Paste the data, run the search, see the result.

**Step 3:** Back in the QOC tab, fill in the structured capture form:
- License status: Active
- License number: R204815
- Expiration date: 2027-04-30
- Public actions: None
- Outcome: ✓ Verified — clean

Click **Save verification.**

**What happens:**
- The checklist item flips to verified
- HR's name, timestamp, captured data all stored as audit evidence
- Reference number generated

Repeat for Nursys, MD Case Search, etc. as you wish.

---

## Stage 10 — Submit to DON

Once all critical items are verified or marked Not Applicable, the green **"Ready for DON final approval"** banner appears at the bottom.

**Click "Submit to DON".**

Application status moves to `ready_for_don_review`.

---

## Stage 11 — DON makes the final decision

1. Stay logged in as Admin (Admin can also act as DON in the seed setup), or log in as a separate `don_approver` if you've created one.
2. Navigate to `/don/final-approval/[applicationId]` — there's a "DON Approval Queue" link in the admin sidebar, or click directly from the verification page.

You're now on the DON Final Approval page.

**What to notice:**
- Header with applicant info + status pill
- **Readiness banner** (green: "Ready for DON decision")
- **Applicant facts** (left) + **Verification summary** (right) — Verified / Pending / Failed-Expired / Not Applicable counts
- **Verification Checklist** — every item with its result
- **Record DON Decision** form

**Click the radio button "Approved for hire"**, write a note like "All credentials verified. Recommended for hire as Pediatric RN.", click **Save decision**.

---

## Stage 12 — Onboarding kicks in autonomously

After DON approval:
- Application status flips to `approved` (or `don_approved`)
- An `EmployeeOnboarding` record is auto-created
- Default onboarding tasks are auto-generated: Review Employee Manual, Compliance Training, Pediatric Care Training, KanTime Training, Submit onboarding documents
- Training recommendations are auto-generated based on the AI rules (KanTime onboarding, Documentation training, Infection control, Pediatric care basics, G-tube care, etc.)

**To verify:**

1. **Switch back to the demo applicant** (log out, log back in as `demo.applicant@qualityonecare.local`)
2. Their dashboard timeline now shows **"DON approval"** lit + **"Outcome"** as current
3. Click **"Onboarding"** in the sidebar
4. See: progress bar (0/5 done), 5 onboarding tasks, recommended trainings list

**Then back as HR:**
- `/hr/training` — kanban view shows the new training recommendations in the "Recommended" column
- Click "Assign" on each to move them to "Assigned"
- The applicant will see assigned trainings on their onboarding page

---

## You've now seen the full autonomous workflow.

**What ran autonomously without your intervention:**
- Status transitions (12+ between stages)
- HR queue creation, task creation, system alerts on submit
- AI review generation
- OIG check against 83K federal records
- Identity cross-validation across documents
- Onboarding checklist auto-creation
- Training recommendations auto-generation

**What stays human (per master plan):**
- Final hire decision (DON)
- Manual verification of sites that don't allow automation (with smart helper)
- HR notes and judgment calls

---

## Reset and try again

```powershell
npm run demo:reset
```

Wipes the demo applicant and recreates a fresh one. The seeded admin / HR / sample applicant accounts are unaffected.

---

## What to try after the demo

1. **Run the OIG check on the seeded sample applicant** at `/hr/applications/[their-id]/verification`
2. **Generate a low-quality applicant** by editing the demo-setup script (e.g., remove the license, leave pediatric experience blank) → see how the AI verdict and validation gate respond
3. **Open `/admin/analytics`** to see the pipeline funnel and bottleneck analysis
4. **Open `/admin/verification-providers`** to see which auto-verifiers are active
5. **Open `/admin/audit`** to see the full audit trail of every action you just performed

---

## If you get stuck

- **Page blank?** Hard refresh (`Ctrl+Shift+R`) — clears stale cache
- **Login fails?** Make sure you're using the exact credentials from the demo-setup output
- **Submit blocked?** The validation panel will tell you what's missing — usually a required document or a pending field review
- **OIG check fails to download?** Your network may be blocking the OIG site; the system falls back to "needs follow-up" and you can verify manually
