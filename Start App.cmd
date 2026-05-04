@echo off
title Quality One Care HR Portal
color 0A
echo.
echo  ============================================
echo   Quality One Care - HR Operations Portal
echo  ============================================
echo.
echo  Starting the app...
echo.
echo  When you see "Ready in X seconds" below,
echo  open your browser to:  http://localhost:3000
echo.
echo  Keep this window open while using the app.
echo  Close this window to stop the app.
echo.
echo  ============================================
echo.

cd /d "%~dp0"
call npm run dev

echo.
echo  ============================================
echo   App stopped. Press any key to close.
echo  ============================================
pause >nul
