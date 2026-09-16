# Rebuilds V Suite and refreshes the folder the owner actually runs
# (C:\Users\HP\Downloads\restaurant), keeping what the build does not carry:
# the .env, the launcher scripts, the database backups, and the native or
# worker packages Next's file tracing only copies in part (sharp, Tesseract).
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-local.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-local.ps1 -SkipBuild

param(
  [string]$Target = "C:\Users\HP\Downloads\restaurant",
  [switch]$SkipBuild,
  [int]$Port = 3100
)

$ErrorActionPreference = "Stop"
$source = Split-Path -Parent $PSScriptRoot

Write-Host "V Suite - deploiement local vers $Target" -ForegroundColor Cyan

if (-not $SkipBuild) {
  Write-Host "1/5 Construction de l'application..."
  Push-Location $source
  npm run build
  Pop-Location
}

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
  Write-Host "2/5 Arret du serveur en cours sur le port $Port..."
  Stop-Process -Id $listening.OwningProcess -Force -Confirm:$false
  Start-Sleep -Seconds 1
}

Write-Host "3/5 Copie du serveur et des pages..."
$null = robocopy "$source\.next\standalone" $Target /MIR /XF .env DEMARRER.bat SAUVEGARDER-BASE.bat RESTAURER-BASE.bat LISEZMOI-MAISON.txt /XD sauvegarde /NFL /NDL /NJH /NJS /NP
$null = robocopy "$source\.next\static" "$Target\.next\static" /MIR /NFL /NDL /NJH /NJS /NP
$null = robocopy "$source\public" "$Target\public" /MIR /NFL /NDL /NJH /NJS /NP

Write-Host "4/5 Copie des modules que la construction ne recopie qu'en partie..."
# sharp (photos) and Tesseract (lecture des tickets) load files at run time, so
# they must be copied whole rather than left to the build's tracing.
$packages = @(
  "@img", "sharp", "detect-libc", "semver", "color", "color-string",
  "color-convert", "color-name", "simple-swizzle", "is-arrayish",
  "tesseract.js", "tesseract.js-core", "@tesseract.js-data", "@napi-rs", "unpdf", "pdfjs-dist",
  "bmp-js", "idb-keyval", "is-url", "node-fetch", "wasm-feature-detect", "zlibjs"
)
foreach ($package in $packages) {
  if (Test-Path "$source\node_modules\$package") {
    $null = robocopy "$source\node_modules\$package" "$Target\node_modules\$package" /E /NFL /NDL /NJH /NJS /NP
  }
}

Write-Host "5/5 Fichiers d'accompagnement..."
foreach ($file in @("DEMARRER.bat", "SAUVEGARDER-BASE.bat", "RESTAURER-BASE.bat", "LISEZMOI-MAISON.txt")) {
  if (Test-Path "$source\$file") { Copy-Item "$source\$file" "$Target\$file" -Force }
}
if (-not (Test-Path "$Target\sauvegarde")) { New-Item -ItemType Directory "$Target\sauvegarde" | Out-Null }

$missing = @(
  "$Target\server.js",
  "$Target\.env",
  "$Target\DEMARRER.bat",
  "$Target\node_modules\@img\sharp-win32-x64\lib\libvips-42.dll",
  "$Target\node_modules\tesseract.js\src\worker-script\node\index.js",
  "$Target\node_modules\@tesseract.js-data\fra\4.0.0_best_int\fra.traineddata.gz"
) | Where-Object { -not (Test-Path $_) }

if ($missing) {
  Write-Host "ATTENTION - fichiers manquants :" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "Termine. Lancez $Target\DEMARRER.bat puis ouvrez http://localhost:$Port" -ForegroundColor Green
}
