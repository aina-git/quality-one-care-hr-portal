# Quality One Care Portal — Cloudflare Tunnel setup
# Exposes your local server to the internet at a real HTTPS URL,
# without paid hosting. Free for personal use.
#
# Two modes:
#   QUICK MODE (no domain, no account): tunnel comes up at random *.trycloudflare.com URL.
#                                       Good for instant testing/demos.
#   AUTHENTICATED MODE (your own domain): persistent named tunnel under qoc.yourdomain.com.
#                                          Survives restarts, used as your real URL.
#
# This script installs cloudflared and runs in QUICK MODE by default.
# For authenticated mode, see the QUICK COMMANDS at the bottom of this file.

$ErrorActionPreference = "Stop"

# Install cloudflared if missing
$CloudflaredPath = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $CloudflaredPath) {
    Write-Host "cloudflared not found. Installing via winget..." -ForegroundColor Yellow
    winget install --id Cloudflare.cloudflared --silent --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $CloudflaredPath = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
    if (-not $CloudflaredPath) {
        Write-Host "ERROR: cloudflared install completed but binary still not on PATH." -ForegroundColor Red
        Write-Host "Open a NEW PowerShell window and re-run this script."
        exit 1
    }
}
Write-Host "cloudflared: $CloudflaredPath"
Write-Host ""

Write-Host "===== Quick mode (instant tunnel, no Cloudflare account needed) =====" -ForegroundColor Cyan
Write-Host "Starting a temporary tunnel to http://localhost:3000..."
Write-Host "When the tunnel comes up, you'll see a URL like https://random-words.trycloudflare.com"
Write-Host "Anyone with that URL can access your app from any device."
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel."
Write-Host ""
Write-Host "(For a permanent named tunnel under your own domain, see notes below.)"
Write-Host ""

& $CloudflaredPath tunnel --url http://localhost:3000

# ──────────────────────────────────────────────────────────────────────────
# AUTHENTICATED MODE (one-time setup for permanent named tunnel)
#
# Prerequisites:
#   - A Cloudflare account (free)
#   - A domain registered or transferred to Cloudflare
#
# Steps:
#   1. cloudflared tunnel login
#      (browser opens — pick the domain to authorize)
#
#   2. cloudflared tunnel create qoc-portal
#      (creates a tunnel and saves credentials to ~/.cloudflared/<UUID>.json)
#
#   3. Create config file ~/.cloudflared/config.yml:
#      ----
#      tunnel: <UUID-from-step-2>
#      credentials-file: C:\Users\<you>\.cloudflared\<UUID>.json
#      ingress:
#        - hostname: qoc.yourdomain.com
#          service: http://localhost:3000
#        - service: http_status:404
#      ----
#
#   4. cloudflared tunnel route dns qoc-portal qoc.yourdomain.com
#      (creates DNS record automatically)
#
#   5. cloudflared tunnel run qoc-portal
#      (starts the persistent tunnel; access at https://qoc.yourdomain.com)
#
#   6. To run as Windows service:
#      cloudflared service install
# ──────────────────────────────────────────────────────────────────────────
