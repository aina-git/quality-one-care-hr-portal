# Quality One Care Portal — Windows service setup
# Registers `npm run start` as a Windows service that auto-starts on boot,
# survives reboots, and runs without a visible terminal window.
#
# Usage: Open PowerShell AS ADMINISTRATOR and run:
#   .\scripts\setup-windows-service.ps1
#
# Prerequisites: NSSM (Non-Sucking Service Manager) — auto-installed via winget if missing.

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
    Write-Host "Right-click PowerShell and choose 'Run as administrator', then re-run this script."
    exit 1
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServiceName = "QualityOneCarePortal"
$NodePath = (Get-Command node).Source
$NpmCmd = Join-Path (Split-Path $NodePath -Parent) "npm.cmd"

Write-Host "Project root: $ProjectRoot"
Write-Host "Node:         $NodePath"
Write-Host "npm:          $NpmCmd"

# Ensure NSSM is installed
$NssmPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $NssmPath) {
    Write-Host ""
    Write-Host "NSSM not found. Installing via winget..." -ForegroundColor Yellow
    winget install NSSM.NSSM --silent --accept-source-agreements --accept-package-agreements
    # Refresh PATH so the new install is visible
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $NssmPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source
    if (-not $NssmPath) {
        Write-Host "ERROR: NSSM install completed but binary still not on PATH." -ForegroundColor Red
        Write-Host "Open a NEW PowerShell window and re-run this script."
        exit 1
    }
}
Write-Host "NSSM:         $NssmPath"
Write-Host ""

# If service already exists, remove it first
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing service..."
    & $NssmPath stop $ServiceName 2>&1 | Out-Null
    & $NssmPath remove $ServiceName confirm 2>&1 | Out-Null
}

Write-Host "Building production bundle (npm run build)..."
Push-Location $ProjectRoot
try {
    & $NpmCmd run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Build failed. Fix build errors before installing service." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Installing service '$ServiceName'..."
& $NssmPath install $ServiceName $NpmCmd "run" "start"
& $NssmPath set $ServiceName AppDirectory $ProjectRoot
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppStdout (Join-Path $ProjectRoot "logs\service-out.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $ProjectRoot "logs\service-err.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 10485760
& $NssmPath set $ServiceName Description "Quality One Care HR Operations Portal — Next.js production server"

# Ensure logs dir exists
New-Item -ItemType Directory -Path (Join-Path $ProjectRoot "logs") -Force | Out-Null

Write-Host "Starting service..."
& $NssmPath start $ServiceName

Start-Sleep -Seconds 3
$status = Get-Service -Name $ServiceName
Write-Host ""
Write-Host "Service status: $($status.Status)" -ForegroundColor (if ($status.Status -eq "Running") { "Green" } else { "Yellow" })
Write-Host ""
Write-Host "Service installed. Quality One Care Portal will now:"
Write-Host "  - Start automatically when Windows boots"
Write-Host "  - Run without a visible terminal window"
Write-Host "  - Log to $ProjectRoot\logs\"
Write-Host ""
Write-Host "Manage the service:"
Write-Host "  Start:   nssm start $ServiceName"
Write-Host "  Stop:    nssm stop $ServiceName"
Write-Host "  Restart: nssm restart $ServiceName"
Write-Host "  Remove:  nssm remove $ServiceName confirm"
Write-Host ""
Write-Host "Visit: http://localhost:3000"
