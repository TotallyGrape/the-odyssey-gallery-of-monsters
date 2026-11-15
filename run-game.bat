@echo off
rem Starts the game's dev server and opens it in your browser.
rem Close this window (or press Ctrl+C) to stop the game.
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed. Get it from https://nodejs.org and run this again.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies, this only happens once...
    call npm install
    if errorlevel 1 (
        echo Install failed.
        pause
        exit /b 1
    )
)

call npm run dev -- --open
pause
