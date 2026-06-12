@echo off
REM 아고다 가격 비교기 — Windows 자동 설치 (관리자 권한 불필요, HKCU 정책)
setlocal
set "ID=ggjogpplbgneanckpfgmdghmkhbddjon"
set "URL=https://raw.githubusercontent.com/trubard/ssan-agoda/main/dist/update.xml"
set "KEY=HKCU\Software\Policies\Google\Chrome\ExtensionInstallForcelist"

echo.
echo  아고다 가격 비교기 설치 (Windows)
echo.

reg add "%KEY%" /v 1 /t REG_SZ /d "%ID%;%URL%" /f >nul
if %errorlevel%==0 (
  echo   크롬 정책에 등록했습니다.
) else (
  echo   등록 실패. 크롬 정책 레지스트리 권한을 확인하세요.
)

echo.
echo  다음 단계:
echo   1) 크롬을 완전히 종료한 뒤 다시 실행하세요.
echo   2) chrome://policy 에서 ExtensionInstallForcelist 에
echo      %ID% 가 보이면 성공입니다.
echo.
pause
