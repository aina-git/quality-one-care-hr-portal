# When you wake up — what's ready and what to do

PR #1 has 21 commits on top of `main`. Branch: `claude/loving-brahmagupta-0daecc`.
Link: https://github.com/aina-git/quality-one-care-hr-portal/pull/1

## Step 1 — Merge the PR

This deploys everything. Railway will auto-redeploy when `main` updates (~5 minutes).

The migration `20260506210000_add_intake_steps` and `20260506220000_add_cross_check_overrides` will run automatically. If either fails, check Railway logs and I'll fix.

## Step 2 — Wipe other users (your explicit ask)

After deploy completes:

1. Sign in to https://hr-portal-prod.up.railway.app/admin/users
2. Scroll to the bottom — there's a **red Danger Zone card**
3. Click **Open reset panel**
4. Type the exact phrase: `DELETE ALL OTHER USERS`
5. Click the red button, confirm the native dialog
6. Page reloads — you'll be the only user, and your role is forced to `super_admin_hr`

## Step 3 — Test the new applicant intake

Create a test applicant from /admin/users (any email, any temp password). Sign in as them in an incognito window. You'll land on the polished applicant dashboard with a hero greeting using their first name.

Click **Start intake packet**. Walk through one or two steps to see how it feels. The 14 forms are: Application, Hep B, Flu, RN/LPN Job Description, Wage Deduction, Physical Health, Reference, Direct Deposit, W-9, W-4, MW507, Skills Checklist, Pre-Employment Test, New Hire Checklist.

## What this PR ships, in plain English

**Applicant side**
- New `/applicant/intake` packet wizard with all 14 QOC forms typed inline
- Personalized hero on dashboard + wizard with one-click "Continue" deep-links
- "What you'll need" pre-flight tip for first-time applicants
- Pre-Employment Clinical Test auto-scores on submit (server-side, answer key never leaves the server)

**HR side**
- Verification page: blocker labels now show real reasons ("Expired 2026-05-12") not stale "(Verified)"
- Identity Cross-Check auto-runs and has Resolve / Revoke buttons per finding with audit trail
- HR dashboard now greets you by name and time of day
- Verification page now has 4 stat cards (Complete %, Blockers, Missing, Expired) at the top
- New "Delete applicant + all data" button on the DON approval page (shows after a decision is recorded)

**Admin side**
- Per-row Delete button on Users page (with Confirm → Force-delete two-step)
- Danger Zone "Reset users" tool (wipes everyone except you)

**Notifications**
- The "29 of the same alert" inflation is fixed — count uses unique groups
- New duplicates auto-merge within a 60-minute window
- Feed shows "×N" pill for repeats

## Known issue I couldn't reproduce

You reported the **Alerts card not navigating**. I read the code carefully — it's a valid Next.js Link to `/admin/notifications` and that page exists. I asked which kind of "nothing" (URL change? sibling Due card works? top-right bell works?) but didn't get answers. After merge, please check those three and tell me the answer. I'll fix in 5 minutes once I know.

## Things still on my list (not yet built)

You mentioned these but they need specifics from you:

- **"Beautiful experience" beyond what I shipped** — tell me one specific page that still looks plain
- **"Clean up the environment"** — tell me what feels cluttered (e.g. "the Excel Monitor — we don't use it" or "the AI auto-mapper makes too many edits")
- **"Remove unnecessary processes"** — same: one example, I'll handle it
- **License Watch / Excel upload didn't function as expected** — when you're ready, paste what the panel shows after you upload an Excel and I'll diagnose
- **Verification UX still rough?** — after you use it post-merge, tell me the specific friction
- **Step 14 Application Updates** — held until you tell me how to flag a user as "existing employee"

Sleep well. I'll be here when you're ready.
