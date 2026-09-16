$ErrorActionPreference = "Stop"

$repoPath = "C:\Users\HP\Desktop\V-Suite"
$logFile = Join-Path $repoPath "auto-sync.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$timestamp] $Message"
}

try {
    Set-Location $repoPath

    if (-not (Test-Path ".git")) {
        throw "Le dossier n'est pas un dépôt Git valide : $repoPath"
    }

    $gitUserName = git config --get user.name
    if (-not $gitUserName) {
        git config user.name "Auto Sync"
    }

    $gitUserEmail = git config --get user.email
    if (-not $gitUserEmail) {
        git config user.email "auto-sync@local"
    }

    $status = git status --porcelain
    if (-not $status) {
        Write-Log "Aucune modification détectée. Synchronisation inutile."
        exit 0
    }

    git add -A
    $commitMessage = "Auto sync $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git commit -m $commitMessage

    git pull --rebase origin main
    git push origin main

    Write-Log "Synchronisation GitHub OK."
}
catch {
    Write-Log "ERREUR : $($_.Exception.Message)"
    throw
}
