@echo off
chcp 65001 > nul
title 행정실 근로 업무 서버

:MENU
cls
echo ========================================
echo       행정실 근로 업무 서버 제어
echo ========================================
echo.
echo  1. 서버 켜기 (백그라운드 실행)
echo  2. 서버 끄기 (완전 종료)
echo  3. 창닫기
echo.
echo ========================================
set /p CHOOSE="원하시는 작업의 번호를 입력하고 엔터를 누르세요: "

if "%CHOOSE%" == "1" goto START
if "%CHOOSE%" == "2" goto STOP
if "%CHOOSE%" == "3" goto EXIT

goto MENU

:START
cls
echo 서버를 시작하는 중입니다...
:: 현재 이 파일이 있는 폴더로 자동 이동
cd /d "%~dp0"

:: 까만 창을 최소화 상태로 띄워서 서버 실행
start "근로용 서버" /min node server.js

echo.
echo ✅ 서버가 백그라운드에서 실행되었습니다!
echo (이 제어판 창을 닫아도 서버는 계속 돌아갑니다)
echo.
pause
goto MENU

:STOP
cls
echo 구동 중인 서버를 찾아서 종료합니다...

:: 실행 중인 Node.js 프로세스를 모두 강제 종료
taskkill /F /IM node.exe /T > nul 2>&1

echo.
echo 🛑 서버가 종료되었습니다.
echo (이제 웹사이트에 접속할 수 없습니다)
echo.
pause
goto MENU

:EXIT
exit