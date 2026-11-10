@echo off
setlocal

REM ============================================================================
REM  Campus Errand (ÖÇÅÜÐ£Ô°) - stop everything
REM ============================================================================

echo.
echo ============================================================
echo        Campus Errand - Stopping
echo ============================================================
echo.

echo [1/3] Backend (Java)
set FOUND=0
for /f "tokens=2" %%p in ('tasklist /fi "imagename eq java.exe" /fo list 2^>nul ^| findstr /i "PID:"') do (
    taskkill /f /pid %%p >nul 2>&1
    echo       killed Java PID=%%p
    set FOUND=1
)
if "%FOUND%"=="0" (echo       no running backend) else (echo       backend stopped)

echo.
echo [2/3] Mini program dev build
set FOUND2=0
for /f "tokens=2" %%p in ('tasklist /fi "imagename eq node.exe" /fo list 2^>nul ^| findstr /i "PID:"') do (
    taskkill /f /pid %%p >nul 2>&1
    echo       killed node PID=%%p
    set FOUND2=1
)
if "%FOUND2%"=="0" (echo       no running node) else (echo       dev build stopped)

echo.
echo [3/3] Redis and MySQL
choice /c YN /m "      Stop Redis and MySQL too? (N = keep, recommended)"
if errorlevel 2 goto :keep

taskkill /f /im redis-server.exe >nul 2>&1
if errorlevel 1 (echo       Redis not running) else (echo       Redis stopped)

net stop MYSQL80 >nul 2>&1
if errorlevel 1 (echo       MySQL not stopped ^(need admin, or not running^)) else (echo       MySQL stopped)
goto :done

:keep
echo       Redis and MySQL kept running

:done
echo.
echo ============================================================
echo                      Stopped
echo ============================================================
echo.
if not defined NO_PAUSE pause
