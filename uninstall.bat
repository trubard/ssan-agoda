@echo off
REM 아고다 가격 비교기 — Windows 제거
setlocal
set "KEY=HKCU\Software\Policies\Google\Chrome\ExtensionInstallForcelist"
echo.
echo  아고다 가격 비교기 제거 (Windows)
reg delete "%KEY%" /v 1 /f >nul 2>&1
echo   정책 항목을 제거했습니다. 크롬을 재시작하면 확장이 사라집니다.
echo.
pause
