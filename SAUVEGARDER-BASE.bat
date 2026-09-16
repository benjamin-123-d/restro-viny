@echo off
chcp 65001 >nul
title V Suite - sauvegarde de la base
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo ===============================================================
echo    V Suite - sauvegarde de la base de donnees
echo ===============================================================
echo.
echo    A faire AVANT de copier le dossier sur un autre ordinateur :
echo    la base PostgreSQL n'est pas dans le dossier, elle est
echo    installee a part. Ce fichier la met dans "sauvegarde".
echo.

REM --- Trouver pg_dump (PostgreSQL 18, 17, 16...) ---
set "PGDUMP="
for /f "delims=" %%D in ('dir /b /o-n "C:\Program Files\PostgreSQL" 2^>nul') do (
  if not defined PGDUMP if exist "C:\Program Files\PostgreSQL\%%D\bin\pg_dump.exe" set "PGDUMP=C:\Program Files\PostgreSQL\%%D\bin\pg_dump.exe"
)
if not defined PGDUMP (
  echo [ERREUR] pg_dump est introuvable. PostgreSQL est-il installe ?
  pause & exit /b 1
)

REM --- Lire DATABASE_URL dans .env ---
set "DBURL="
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if "%%A"=="DATABASE_URL" set "DBURL=%%B"
)
if not defined DBURL (
  echo [ERREUR] DATABASE_URL est introuvable dans le fichier .env
  pause & exit /b 1
)
set "DBURL=%DBURL:"=%"

if not exist "sauvegarde" mkdir "sauvegarde"
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "STAMP=%%T"
set "OUT=sauvegarde\restro-%STAMP%.dump"

echo Sauvegarde en cours vers %OUT% ...
"%PGDUMP%" --format=custom --no-owner --no-privileges --file="%OUT%" "%DBURL%"
if errorlevel 1 (
  echo.
  echo [ERREUR] La sauvegarde a echoue. PostgreSQL est-il demarre ?
  pause & exit /b 1
)

echo.
echo Termine : %OUT%
echo Copiez maintenant tout le dossier sur l'autre ordinateur,
echo puis lancez RESTAURER-BASE.bat la-bas.
echo.
pause
