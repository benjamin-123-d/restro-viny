@echo off
title V Suite - Restaurant Viny
cd /d "%~dp0"

echo ===============================================================
echo    V Suite - demarrage du serveur
echo ===============================================================
echo.
echo    Adresse : http://localhost:3100
echo.
echo    Laisse cette fenetre OUVERTE tant que tu utilises V Suite.
echo    Ctrl+C pour arreter.
echo ===============================================================
echo.

REM PostgreSQL doit tourner : la base "restro" est lue depuis .env
set PORT=3100
set HOSTNAME=127.0.0.1
set NODE_ENV=production

start "" http://localhost:3100
node server.js

echo.
echo Le serveur s'est arrete. Appuie sur une touche pour fermer.
pause >nul
