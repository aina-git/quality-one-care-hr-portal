# Quality One Care Portal — Nightly backup scheduled task
# Registers a Windows scheduled task that runs `npm run backup` every night at 2 AM.
# Backups land in /backups/<timestamp>/ as JSON exports.
#
# Usage: Open PowerShell AS ADMINISTRATOR and run:
#   .\scripts\setup-nightly-backup.ps1

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
    exit 1
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TaskName = "QualityOneCare_NightlyBackup"
$NpmCmd = Join-Path (Split-Path (Get-Command node).Source -Parent) "npm.cmd"

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the action: cmd /c "cd /d <project> && npm run backup"
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"cd /d `"$ProjectRoot`" && `"$NpmCmd`" run backup`""

# Trigger: every day at 2 AM
$Trigger = New-ScheduledTaskTrigger -Daily -At 2am

# Settings: allow on AC + battery, run if missed, prevent overlap
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

# Run as SYSTEM so it doesn't need a logged-in user
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Nightly Quality One Care portal database + uploads backup at 2 AM"

Write-Host ""
Write-Host "✓ Nightly backup task installed." -ForegroundColor Green
Write-Host ""
Write-Host "Schedule:    every day at 2:00 AM"
Write-Host "Backups go to: $ProjectRoot\backups\<timestamp>\"
Write-Host ""
Write-Host "Test it now:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName"
Write-Host ""
Write-Host "Manage:"
Write-Host "  Get-ScheduledTask -TaskName $TaskName"
Write-Host "  Disable-ScheduledTask -TaskName $TaskName"
Write-Host "  Unregister-ScheduledTask -TaskName $TaskName"
