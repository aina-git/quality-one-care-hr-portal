# Local Always-On Hosting Setup

This guide turns your local Windows PC into a permanent, always-on, internet-accessible host for the Quality One Care portal — at $0/yr (or ~$10/yr with your own domain).

## What you get

- ✅ App auto-starts on Windows boot, runs without a visible terminal
- ✅ Survives reboots and crashes (auto-restart on failure)
- ✅ Accessible from any device with an HTTPS URL (Cloudflare Tunnel)
- ✅ Nightly automated backups
- ✅ Logs to `logs/` folder for troubleshooting

## Prerequisites

- Windows 10/11
- PostgreSQL already installed (you already have this)
- Node.js installed (you already have this)
- 5 minutes of admin time

---

## Step 1 — Register the app as a Windows service

Open **PowerShell as Administrator** (right-click → "Run as administrator"), then:

```powershell
cd "C:\Users\honpa\Documents\New project"
.\scripts\setup-windows-service.ps1
```

This:
- Installs NSSM (service wrapper) via winget if missing
- Builds the production bundle
- Registers `npm run start` as a Windows service named `QualityOneCarePortal`
- Sets it to auto-start on boot
- Logs stdout/stderr to `logs/service-out.log` and `logs/service-err.log`

**Verify:** open http://localhost:3000 — the app should be there. Reboot your PC; it should still be there.

---

## Step 2 — Set up nightly automated backups

Same Administrator PowerShell:

```powershell
.\scripts\setup-nightly-backup.ps1
```

This registers a Windows Scheduled Task that runs `npm run backup` every night at 2 AM. Backups land in `backups/<timestamp>/` as JSON exports of users, applications, and audit logs.

**Verify:** in PowerShell, run `Start-ScheduledTask -TaskName QualityOneCare_NightlyBackup` and check `backups/` for a fresh folder.

---

## Step 3 — Expose the app to the internet (Cloudflare Tunnel)

This gives you an HTTPS URL accessible from any device, without paid hosting.

### Option A — Quick mode (instant, temporary URL)

In any PowerShell window:

```powershell
.\scripts\setup-cloudflare-tunnel.ps1
```

This installs cloudflared if missing and starts a tunnel. You'll see output like:

```
Your quick tunnel is at: https://random-words.trycloudflare.com
```

Anyone with that URL can access the app. Closes when you Ctrl+C.

**Use case:** demo to a stakeholder, test from your phone right now.

### Option B — Permanent named tunnel (requires Cloudflare account + domain)

For a real URL like `qoc.yourdomain.com` that doesn't change:

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
2. Add your domain (transfer DNS to Cloudflare — free)
3. In PowerShell:
   ```powershell
   cloudflared tunnel login
   # browser opens — authorize your domain
   
   cloudflared tunnel create qoc-portal
   # note the UUID printed
   
   cloudflared tunnel route dns qoc-portal qoc.yourdomain.com
   ```
4. Create `C:\Users\<you>\.cloudflared\config.yml`:
   ```yaml
   tunnel: <UUID-from-step-3>
   credentials-file: C:\Users\<you>\.cloudflared\<UUID>.json
   ingress:
     - hostname: qoc.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. Run as Windows service:
   ```powershell
   cloudflared service install
   ```

Now `https://qoc.yourdomain.com` permanently routes to your local app, with HTTPS, from any device.

**Cost:** ~$10/yr for the domain (Cloudflare or any registrar). Tunnel itself is free.

---

## What's running where

| Component | Location | Auto-start | Survives reboot |
|---|---|---|---|
| PostgreSQL | Windows service `postgresql-x64-16` | ✅ | ✅ |
| Quality One Care app | Windows service `QualityOneCarePortal` | ✅ (after Step 1) | ✅ |
| Cloudflare Tunnel | Windows service `cloudflared` | ✅ (after Step 3 Option B) | ✅ |
| Nightly backup | Scheduled task `QualityOneCare_NightlyBackup` | 2 AM daily | ✅ |

---

## Limitations to be aware of

1. **PC must be on for the app to be accessible.** If your computer sleeps or shuts down, the app goes down. Consider disabling sleep on AC power, or buying a small NUC/mini-PC dedicated to running it 24/7.

2. **Your home internet is the bottleneck.** Cloudflare Tunnel routes all traffic through your home connection. Fine for low-volume HR use; not fine for thousands of concurrent users.

3. **HIPAA / PHI considerations.** This setup is fine for development and demo. Before storing real applicant PII/PHI, you'd want to:
   - Enable Windows BitLocker disk encryption (free, built-in)
   - Restrict who has access to the PC physically
   - Enable Cloudflare Access policies on the tunnel (free, gates by email/SSO)
   - Consider whether HIPAA applies to your specific use and act accordingly

4. **Backups are local only.** The nightly backup writes to `backups/` on the same disk. If the disk dies, backups die with it. Consider periodically copying `backups/` to an external drive or cloud sync (OneDrive, Google Drive).

---

## Troubleshooting

### Service won't start
Check logs: `logs\service-err.log` and `logs\service-out.log`.

Common causes:
- PostgreSQL service not running → `Get-Service postgresql-x64-16`
- Port 3000 already in use → `netstat -ano | findstr ":3000"`
- Build failed → run `npm run build` manually to see errors

### Cloudflare Tunnel disconnects
Cloudflared has its own logs at `C:\Windows\System32\config\systemprofile\.cloudflared\` (when running as service).

### Need to upgrade the app code
1. Stop service: `nssm stop QualityOneCarePortal`
2. Pull/edit code
3. Rebuild: `npm run build`
4. Run any new migrations: `npx prisma migrate deploy`
5. Start service: `nssm start QualityOneCarePortal`

Or just run `setup-windows-service.ps1` again — it removes + reinstalls cleanly.
