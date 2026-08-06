@echo off
rem ---------------------------------------------------------------------------
rem  Startet den Marktplaner.
rem  Einfach doppelklicken. Dieses schwarze Fenster muss offen bleiben,
rem  solange du mit dem Programm arbeitest. Zum Beenden das Fenster schliessen.
rem ---------------------------------------------------------------------------

cd /d "%~dp0"
title Marktplaner - bitte offen lassen

echo.
echo   ==========================================================
echo     MARKTPLANER
echo   ==========================================================
echo.

rem Beim allerersten Start fehlen die benoetigten Bausteine noch.
if not exist "node_modules" (
  echo   Einmalige Einrichtung laeuft. Das dauert ein bis zwei Minuten ...
  echo.
  call npm install
  echo.
)

rem Den Browser mit kurzer Verzoegerung oeffnen, damit der Server bereit ist.
start "" /min cmd /c "ping -n 4 127.0.0.1 >nul & explorer http://localhost:5180"

echo   Der Marktplaner oeffnet sich gleich im Browser.
echo   Adresse: http://localhost:5180
echo.
echo   Dieses Fenster bitte offen lassen.
echo.

call npm run dev

echo.
echo   Der Marktplaner wurde beendet.
pause
