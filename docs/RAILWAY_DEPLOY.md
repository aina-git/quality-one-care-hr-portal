# Deploy to Railway — step-by-step

This guide gets the Quality One Care HR Portal live on Railway (same platform as Honpass AI). Total time: ~10 minutes.

## What you'll end up with

- App live at `https://qualityonecare-production-XXXX.up.railway.app` (or a custom domain you attach)
- Cloud PostgreSQL database (Railway-hosted, automatic backups)
- Auto-deploy on every git push
- Environment variables managed in Railway dashboard

## What you need

- Your existing Railway account (the one hosting Honpass AI)
- A GitHub account
- ~10 minutes

---

## Step 1 — Push the code to GitHub (first time only)

### 1a. Create a new GitHub repo

1. Go to https://github.com/new
2. Repo name: `quality-one-care-hr-portal` (or any name)
3. **Set it to Private** (this is healthcare HR code — not public)
4. Don't initialize with anything (no README, no .gitignore, no license)
5. Click **Create repository**
6. On the next page, **copy the URL** under "Quick setup" — looks like `https://github.com/YOURNAME/quality-one-care-hr-portal.git`

### 1b. Push the code

Open Command Prompt (not PowerShell), then:

```cmd
cd "C:\Users\honpa\Documents\New project"
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOURNAME/quality-one-care-hr-portal.git
git push -u origin main
```

Replace `YOURNAME` with your GitHub username. You'll be prompted for GitHub credentials — use a Personal Access Token instead of password (GitHub stopped accepting passwords for git).

If you don't have a Personal Access Token:
1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a name, set expiration to 90 days, check the **repo** scope
4. Click Generate, copy the token, paste when git asks for password

---

## Step 2 — Create the Railway project

1. Go to https://railway.app/new
2. Click **Deploy from GitHub repo**
3. Select your `quality-one-care-hr-portal` repo
4. Railway starts the first build (it'll fail — that's expected, no DB yet)

---

## Step 3 — Add PostgreSQL

1. In your new Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Wait ~30 seconds for it to provision
3. Click on the Postgres service → **Variables** tab → copy `DATABASE_URL`

---

## Step 4 — Set environment variables on the app service

1. In your Railway project, click the **app service** (the one named after your repo)
2. Click **Variables**
3. Add these variables one at a time:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Paste the value from Step 3 |
| `AUTH_SECRET` | Generate a 32+ char random string. Use https://1password.com/password-generator/ — set length to 40+ |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now — Railway will give you a URL after first deploy |
| `NODE_ENV` | `production` |
| `JOB_RUNNER_ENABLED` | `true` |
| `OCR_PROVIDER` | `local` |
| `STORAGE_PROVIDER` | `local` |
| `EMAIL_FROM` | `hr@qualityonecare.com` |

4. Click **Deploy** to trigger a redeploy with the new env vars

---

## Step 5 — Get the URL + finalize

1. After deploy succeeds (~2–3 min), click **Settings** on the app service
2. Under **Networking**, click **Generate Domain** — Railway gives you a `*.up.railway.app` URL
3. Copy that URL. Go back to **Variables** and set `NEXT_PUBLIC_APP_URL` to that URL
4. Trigger one more redeploy

---

## Step 6 — Seed the production database

The new database is empty. You need to seed admin/HR users:

In Railway's app service, click **Settings** → scroll to **Service** → click **Run Command** (or use the Railway CLI). Run:

```
npm run prisma:seed
```

This creates:
- Admin: `admin@qualityonecare.local` / `Admin123!`
- HR: `hr@qualityonecare.local` / `Hr123!`
- Sample applicant: `applicant@qualityonecare.local` / `Applicant123!`

**Change these passwords immediately** — log in as admin and update them via the user management page (`/admin/users`) before any real applicant gets the URL.

---

## Step 7 — Open it

Visit your `https://yourapp.up.railway.app/login` and sign in.

---

## Custom domain (optional, do this later)

When you're ready to attach a custom domain (like `qoc.yourdomain.com`):

1. **Buy a domain** if you don't have one. Cloudflare registrar is the cheapest (~$10/yr).
2. In Railway → your app service → **Settings** → **Networking** → **+ Custom Domain**
3. Enter your domain, copy the CNAME record Railway shows
4. In your DNS provider, add the CNAME pointing to Railway's value
5. Wait 5–60 min for DNS propagation
6. Update `NEXT_PUBLIC_APP_URL` env var to the new domain, redeploy

---

## After it's deployed

- **Auto-deploy** — every `git push` to main triggers a Railway redeploy
- **Logs** — Railway → your service → **Deployments** → click any deploy → **View Logs**
- **Database backups** — Railway → Postgres service → **Backups** tab. Enable daily backups (free tier includes them).
- **Roll back** — Railway → **Deployments** → click any prior deploy → **Redeploy**

---

## Always-on hosting

Railway uses usage-based pricing. To guarantee 24/7 availability:

1. Make sure your Railway account has a **payment method on file** (same as Honpass AI uses)
2. The **Hobby plan** ($5/mo) is enough for low-to-moderate traffic and gives you no-sleep guarantee plus $5 of usage credit
3. Watch the usage in Railway → **Account Settings** → **Usage** — if you cross $5 in a month, top up

If your account is already paying for Honpass AI on Railway, this app can run on the same plan.

## Things to handle later (not blocking initial launch)

1. **Custom domain** with HTTPS (Railway gives free TLS once attached)
2. **Storage** — currently uses local disk. Railway's filesystem is ephemeral, so uploaded documents disappear on redeploy. For real use, switch to S3/R2 (set `STORAGE_PROVIDER=s3` + the related env vars) OR add a Railway Volume mounted at `/storage`.
3. **Email** — currently queues messages without sending. Set `EMAIL_PROVIDER=resend` (or `sendgrid`) + `EMAIL_API_KEY` + `EMAIL_FROM` to enable real email delivery.
