@echo off
chcp 65001 >nul
title V Suite - restauration de la base
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo ===============================================================
echo    V Suite - restauration de la base de donnees
echo ===============================================================
echo.
echo    A faire sur le NOUVEL ordinateur, une fois PostgreSQL
echo    installe et le dossier copie.
echo.

set "PGBIN="
for /f "delims=" %%D in ('dir /b /o-n "C:\Program Files\PostgreSQL" 2^>nul') do (
  if not defined PGBIN if exist "C:\Program Files\PostgreSQL\%%D\bin\pg_restore.exe" set "PGBIN=C:\Program Files\PostgreSQL\%%D\bin"
)
if not defined PGBIN (
  echo [ERREUR] PostgreSQL est introuvable. Installez PostgreSQL 17 ou plus.
  pause & exit /b 1
)

set "DBURL="
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if "%%A"=="DATABASE_URL" set "DBURL=%%B"
)
if not defined DBURL (
  echo [ERREUR] DATABASE_URL est introuvable dans le fichier .env
  pause & exit /b 1
)
set "DBURL=%DBURL:"=%"

REM --- Derniere sauvegarde du dossier "sauvegarde" ---
set "DUMP=%~1"
if not defined DUMP (
  for /f "delims=" %%F in ('dir /b /o-d "sauvegarde\*.dump" 2^>nul') do (
    if not defined DUMP set "DUMP=sauvegarde\%%F"
  )
)
if not defined DUMP (
  echo [ERREUR] Aucune sauvegarde .dump trouvee dans le dossier "sauvegarde".
  pause & exit /b 1
)

echo Sauvegarde a restaurer : %DUMP%
echo Base visee : %DBURL%
echo.
echo ATTENTION : les donnees deja presentes dans cette base seront
echo remplacees par celles de la sauvegarde.
echo.
set /p CONFIRM="Tapez OUI puis Entree pour continuer : "
if /i not "%CONFIRM%"=="OUI" (
  echo Annule. Rien n'a ete modifie.
  pause & exit /b 0
)

echo.
echo Restauration en cours...
"%PGBIN%\pg_restore.exe" --clean --if-exists --no-owner --no-privileges --dbname="%DBURL%" "%DUMP%"
if errorlevel 1 (
  echo.
  echo [INFO] Des avertissements sont normaux si la base etait vide.
  echo Verifiez simplement que l'application demarre.
)

echo.
echo Termine. Lancez DEMARRER.bat pour ouvrir V Suite.
echo.
pause
