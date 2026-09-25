@echo off
setlocal
cd /d "%~dp0"
echo [QuizTown DEV] Windows client build
where node >nul 2>nul || (echo ERROR: Node.js is not installed.& pause & exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm is not installed.& pause & exit /b 1)
call npm install
if errorlevel 1 (echo ERROR: npm install failed.& pause & exit /b 1)
call npm run dist:win
if errorlevel 1 (echo ERROR: Windows build failed.& pause & exit /b 1)
echo.
echo SUCCESS: Check the dist folder for QuizTown-Dev-*-Setup.exe
pause
