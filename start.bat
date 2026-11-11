@echo off
chcp 65001 >nul
title SKYWARD SALVAGE — FINAL BUILD
cd /d "%~dp0"

echo ============================================
echo   SKYWARD SALVAGE - FINAL BUILD
echo ============================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    echo Dang mo game tai http://localhost:8080
    echo (bam Ctrl+C de dong server)
    echo.
    start "" "http://localhost:8080"
    timeout /t 2 >nul
    python -m http.server 8080
) else (
    echo Khong tim thay Python. Mo thang bang trinh duyet...
    start "" "%~dp0index.html"
    echo.
    echo Da mo index.html bang trinh duyet mac dinh.
    pause
)
