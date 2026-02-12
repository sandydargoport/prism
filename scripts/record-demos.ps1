<#
.SYNOPSIS
  Records demo GIFs for Prism README.
  Runs Playwright scenarios with video capture, then converts .webm to optimized .gif via ffmpeg.

.DESCRIPTION
  Prerequisites:
    - ffmpeg installed (winget install Gyan.FFmpeg)
    - Prism app running (docker-compose up -d)
    - Seed data loaded

.EXAMPLE
  .\scripts\record-demos.ps1
#>

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DemoDir = Join-Path $ProjectRoot "docs\demos"
$VideoDir = Join-Path $ProjectRoot "e2e\demos\videos"

# --- Preflight checks ---

Write-Host "`n=== Prism Demo Recorder ===" -ForegroundColor Cyan

# Check ffmpeg
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: ffmpeg not found. Install with: winget install Gyan.FFmpeg" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] ffmpeg found" -ForegroundColor Green

# Check app is running
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    if ($health.StatusCode -ne 200) { throw "Non-200" }
    Write-Host "[OK] App is running at localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "ERROR: App not reachable at localhost:3000. Run: docker-compose up -d" -ForegroundColor Red
    exit 1
}

# Create output directories
New-Item -ItemType Directory -Force -Path $DemoDir | Out-Null
New-Item -ItemType Directory -Force -Path $VideoDir | Out-Null

# --- Reset seed data ---

Write-Host "`nResetting demo data..." -ForegroundColor Yellow
$sqlFile = Join-Path $env:TEMP "prism-demo-reset.sql"
@"
UPDATE tasks SET completed = false, completed_at = NULL, completed_by = NULL
  WHERE title != 'Return library books' AND completed = true;
UPDATE shopping_items SET checked = false;
DELETE FROM chore_completions WHERE completed_at > now() - interval '1 day';
DELETE FROM settings WHERE key IN ('awayMode', 'babysitterMode');
DELETE FROM recipes WHERE name LIKE 'Demo:%';
"@ | Set-Content -Path $sqlFile -Encoding UTF8

try {
    Get-Content $sqlFile | docker exec -i prism-db psql -U prism -d prism 2>&1 | Out-Null
    docker exec prism-redis redis-cli FLUSHDB 2>&1 | Out-Null
    Write-Host "[OK] Data reset" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not reset data: $_" -ForegroundColor Yellow
}
Remove-Item $sqlFile -ErrorAction SilentlyContinue

# --- Run Playwright tests ---

Write-Host "`nRunning Playwright demo scenarios..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    # Use relative path to avoid Windows backslash issues with npx
    & npx playwright test --config "e2e/demos/demo.config.ts"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Some scenarios may have failed (exit code $LASTEXITCODE)." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

# --- Convert .webm to .gif ---

Write-Host "`nConverting videos to GIFs..." -ForegroundColor Yellow

# Find all .webm files in test-results
$webmFiles = Get-ChildItem -Path (Join-Path $ProjectRoot "test-results") -Filter "*.webm" -Recurse -ErrorAction SilentlyContinue

if ($webmFiles.Count -eq 0) {
    Write-Host "ERROR: No .webm files found in test-results/. Did Playwright record videos?" -ForegroundColor Red
    exit 1
}

# Map scenario names to output filenames
$scenarioMap = @{
    "01-dashboard" = "dashboard-overview"
    "02-light-dark" = "light-dark-toggle"
    "03-chore" = "chore-celebration"
    "04-grocery" = "grocery-shopping"
    "05-recipe" = "recipe-view"
    "06-away" = "away-mode"
    "07-babysitter" = "babysitter-mode"
}

foreach ($webm in $webmFiles) {
    # Determine output name from parent folder or file name
    $outputName = $null
    foreach ($key in $scenarioMap.Keys) {
        if ($webm.FullName -match $key) {
            $outputName = $scenarioMap[$key]
            break
        }
    }
    if (-not $outputName) {
        $outputName = [System.IO.Path]::GetFileNameWithoutExtension($webm.Name)
    }

    $outputGif = Join-Path $DemoDir "$outputName.gif"

    Write-Host "  Converting: $($webm.Name) -> $outputName.gif" -ForegroundColor Gray

    # ffmpeg: trim 1.5s startup (browser white screen), 12fps, 640px wide, 128-color Bayer dithered palette
    # ffmpeg writes progress to stderr; temporarily relax error handling
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & ffmpeg -y -ss 1.5 -i $webm.FullName `
        -vf "fps=12,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" `
        -loop 0 $outputGif 2>&1 | Out-Null
    $ErrorActionPreference = $prevPref

    if (Test-Path $outputGif) {
        $sizeMB = [math]::Round((Get-Item $outputGif).Length / 1MB, 2)
        Write-Host "    -> $outputName.gif ($sizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "    -> FAILED to create $outputName.gif" -ForegroundColor Red
    }
}

# --- Summary ---

Write-Host "`n=== Results ===" -ForegroundColor Cyan
$gifs = Get-ChildItem -Path $DemoDir -Filter "*.gif" -ErrorAction SilentlyContinue
if ($gifs.Count -gt 0) {
    $totalMB = 0
    foreach ($gif in $gifs) {
        $sizeMB = [math]::Round($gif.Length / 1MB, 2)
        $totalMB += $sizeMB
        Write-Host "  $($gif.Name) - $sizeMB MB" -ForegroundColor White
    }
    Write-Host "`n  Total: $($gifs.Count) GIFs, $([math]::Round($totalMB, 2)) MB" -ForegroundColor Green
    Write-Host "  Output: $DemoDir" -ForegroundColor Green
} else {
    Write-Host "  No GIFs generated." -ForegroundColor Red
}

Write-Host ""
