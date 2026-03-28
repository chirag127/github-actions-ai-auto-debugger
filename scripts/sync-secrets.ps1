# Sync .env to GitHub Repository Secrets
# Requires GitHub CLI (gh) and authentication (gh auth login)

if (!(Test-Path ".env")) {
    Write-Error ".env file not found."
    exit 1
}

Write-Host "Reading .env and syncing secrets to GitHub..." -ForegroundColor Cyan

# Read .env file line by line
Get-Content ".env" | ForEach-Object {
    # Skip comments and empty lines
    if ($_ -match '^\s*[^#\s][^=]*=[^#]*') {
        # Split into key and value
        $parts = $_ -split '=', 2
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        # Remove surrounding quotes if present
        if ($value -match '^".*"$') {
            $value = $value.Substring(1, $value.Length - 2)
        } elseif ($value -match "^'.*'$") {
            $value = $value.Substring(1, $value.Length - 2)
        }

        # Handle escaped newlines (\n) in the value
        $value = $value -replace '\\n', "`n"

        if ($key -and $value) {
            Write-Host "Syncing secret: $key" -ForegroundColor Gray
            $value | gh secret set $key
        }
    }
}

Write-Host "Successfully synced secrets to GitHub repository." -ForegroundColor Green
