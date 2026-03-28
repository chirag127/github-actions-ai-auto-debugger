# Sync .env to GitHub Repository Secrets and Cloudflare Worker Secrets
# Requires GitHub CLI (gh) authenticated via `gh auth login`
# Optionally syncs to Cloudflare if wrangler is installed

param(
    [string]$Repo = "chirag127/github-actions-ai-auto-debugger",
    [string]$Worker = "ai-auto-debugger-proxy"
)

if (!(Test-Path ".env")) {
    Write-Error ".env file not found. Copy .env.example to .env first."
    exit 1
}

Write-Host "Reading .env and syncing secrets..." -ForegroundColor Cyan
Write-Host "  Repository: $Repo" -ForegroundColor DarkGray

# Keys that should NOT be synced (local-only or empty placeholders)
$skipKeys = @(
    "TARGET_REPO_OWNER",
    "TARGET_REPO_NAME",
    "TARGET_RUN_ID",
    "TARGET_INSTALLATION_ID",
    "TARGET_HEAD_SHA",
    "TARGET_BRANCH"
)

# GitHub reserves the GITHUB_ prefix for secret names.
# Map these to GH_ prefix for GitHub Secrets.
$nameMapping = @{
    "GITHUB_APP_ID"         = "GH_APP_ID"
    "GITHUB_APP_PRIVATE_KEY" = "GH_APP_PRIVATE_KEY"
    "GITHUB_MODELS_TOKEN"   = "GH_MODELS_TOKEN"
    "GITHUB_TOKEN"          = "GH_TOKEN"
}

$synced = 0
$skipped = 0

Get-Content ".env" | ForEach-Object {
    # Skip comments and empty lines
    if ($_ -match '^\s*#|^\s*$') { return }
    if ($_ -notmatch '^\s*([^=]+?)\s*=\s*(.*)$') { return }

    $key = $matches[1].Trim()
    $value = $matches[2].Trim()

    # Remove surrounding quotes
    if ($value -match '^"(.*)"$') { $value = $matches[1] }
    elseif ($value -match "^'(.*)'$") { $value = $matches[1] }

    # Restore literal newlines from \n escapes
    $value = $value -replace '\\n', "`n"

    # Skip empty values and local-only keys
    if (!$value) {
        Write-Host "  SKIP (empty): $key" -ForegroundColor DarkYellow
        $skipped++
        return
    }
    if ($skipKeys -contains $key) {
        Write-Host "  SKIP (local): $key" -ForegroundColor DarkYellow
        $skipped++
        return
    }

    # Determine the GitHub secret name (handle GITHUB_ prefix)
    $secretName = if ($nameMapping.ContainsKey($key)) {
        $nameMapping[$key]
    } else { $key }

    # Sync to GitHub
    Write-Host "  SET secret: $secretName" -ForegroundColor Gray
    $value | gh secret set $secretName --repo $Repo 2>$null
    if ($LASTEXITCODE -eq 0) { $synced++ }

    # Sync to Cloudflare Worker (if wrangler is available)
    if ($null -ne (Get-Command "wrangler" -ErrorAction SilentlyContinue)) {
        Write-Host "  SET CF secret: $key (worker: $Worker)" -ForegroundColor DarkGray
        $value | wrangler secret put $key --name $Worker 2>$null
    }
}

Write-Host ""
Write-Host "Done. Synced: $synced, Skipped: $skipped" -ForegroundColor Green
