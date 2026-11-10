@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  Campus Errand (ÖÇÅÜÐ£Ô°) - one click start
REM
REM  Starts MySQL + Redis + backend + mini program dev build
REM
REM  IMPORTANT: the backend uses port 3000, which is ALSO used by the
REM  AI Rhythm Guardian backend. Never run both at the same time.
REM ============================================================================

set "ROOT=D:\ÖÇÅÜÐ£Ô°"
set "SERVER_DIR=%ROOT%\ºó¶Ë\zhipao-server"
set "APP_DIR=%ROOT%\Ð¡³ÌÐò"
set "JDK_HOME=C:\Users\msr150174\.jdks\openjdk-25"
set "NODE_HOME=D:\Program Files\nodejs"
set "REDIS_DIR=D:\redis"
set "LOG_DIR=%SERVER_DIR%\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo.
echo ============================================================
echo        Campus Errand - Starting
echo ============================================================
echo.

REM ==================== 0. port guard ====================
REM Both projects listen on 3000. Check who owns it before starting.
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 2; Write-Host ('      : ' + $r.data.service); exit 0 } catch { exit 1 }" 2>nul
if not errorlevel 1 (
    echo [0/4] Port check
    echo       WARNING: port 3000 is already in use.
    echo.
    powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 2; Write-Host ('      running service: ' + $r.data.service) } catch {}"
    echo.
    echo       This is usually the AI Rhythm Guardian backend, which
    echo       shares port 3000. Two options:
    echo.
    echo         A. stop it first  - run guardian-server\stop.bat
    echo         B. continue       - this script will stop it for you
    echo.
    echo       Auto-continuing in 8 seconds, press A to abort...
    choice /c AB /t 8 /d B /m "      Choose"
    if errorlevel 2 goto :kill_java
    if errorlevel 1 goto :abort
)

:kill_java
REM stop any java so we can bind 3000
for /f "tokens=2" %%p in ('tasklist /fi "imagename eq java.exe" /fo list 2^>nul ^| findstr /i "PID:"') do (
    taskkill /f /pid %%p >nul 2>&1
)
ping -n 3 127.0.0.1 >nul

REM ==================== 1. MySQL ====================
echo [1/4] MySQL

sc query "MYSQL80" 2>nul | findstr /i "RUNNING" >nul
if errorlevel 1 (
    echo       starting service...
    net start "MYSQL80" >nul 2>&1
    if errorlevel 1 (
        echo       [WARN] could not start MYSQL80
    ) else (
        echo       started
    )
) else (
    echo       running
)

REM wait for it to accept connections
set /a MW=0
:mysql_wait
"D:\mysql\bin\mysql.exe" -uroot -pmsr150174 -e "SELECT 1" >nul 2>&1
if not errorlevel 1 goto :mysql_ok
ping -n 3 127.0.0.1 >nul
set /a MW+=2
if %MW% lss 30 goto :mysql_wait
echo       [WARN] MySQL not responding after 30s
goto :redis_step

:mysql_ok
echo       connection ok

REM check the xyzp database
REM NOTE: MySQL does not resolve 0x hex literals in SHOW DATABASES LIKE,
REM so the plain quoted form is required here.
set "DBTMP=%TEMP%\zhipao_dbcheck.txt"
if exist "%DBTMP%" del "%DBTMP%" >nul 2>&1
"D:\mysql\bin\mysql.exe" -uroot -pmsr150174 -N -B -e "SHOW DATABASES LIKE 'xyzp'" > "%DBTMP%" 2>nul
set "HASDB="
if exist "%DBTMP%" set /p HASDB=<"%DBTMP%"
if defined HASDB (
    echo       database xyzp ok
) else (
    echo       [WARN] database xyzp not found
    echo              import it first from the db folder
)

:redis_step

REM ==================== 2. Redis ====================
echo.
echo [2/4] Redis

tasklist /fi "imagename eq redis-server.exe" 2>nul | findstr /i "redis-server.exe" >nul
if not errorlevel 1 (
    echo       running
    goto :compile
)

if not exist "%REDIS_DIR%\redis-server.exe" (
    echo       [WARN] redis not found at %REDIS_DIR%
    goto :compile
)

echo       starting...
if exist "%REDIS_DIR%\redis.windows.conf" (
    start "Redis" /min "%REDIS_DIR%\redis-server.exe" "%REDIS_DIR%\redis.windows.conf"
) else (
    start "Redis" /min "%REDIS_DIR%\redis-server.exe"
)
ping -n 5 127.0.0.1 >nul
echo       started

REM ==================== 3. backend ====================
:compile
echo.
echo [3/4] Backend

if not exist "%SERVER_DIR%\pom.xml" (
    echo       [ERROR] backend not found: %SERVER_DIR%
    goto :fail
)

REM if start.bat exists use it, otherwise compile manually
if exist "%SERVER_DIR%\start.bat" (
    echo       using server start.bat  ^(opens its own window^)
    set NO_PAUSE=1
    start "ZhipaoBackend" cmd /c ""%SERVER_DIR%\start.bat""
) else (
    echo       [WARN] no start.bat, trying manual compile
    if exist "%SERVER_DIR%\build-helper.ps1" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%SERVER_DIR%\build-helper.ps1" ^
          -M2Repo "C:\Users\msr150174\.m2\repository" ^
          -SrcDir "%SERVER_DIR%\src\main\java" ^
          -OutDir "%SERVER_DIR%\target\classes" ^
          -ResDir "%SERVER_DIR%\src\main\resources" ^
          -LombokJar "C:\Users\msr150174\.m2\repository\org\projectlombok\lombok\1.18.48\lombok-1.18.48.jar" ^
          -TempDir "%TEMP%"
        "%JDK_HOME%\bin\javac.exe" "@%TEMP%\zhipao_javac.txt"
        start "ZhipaoBackend" cmd /k ""%JDK_HOME%\bin\java.exe" -Dfile.encoding=UTF-8 @%TEMP%\zhipao_run.txt"
    ) else (
        echo       [ERROR] cannot build backend
        goto :fail
    )
)

echo       waiting for backend...
set /a W=0
:waitloop
ping -n 4 127.0.0.1 >nul
set /a W+=3
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 3; if ($r.data.status) { exit 0 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :backend_ok
if %W% lss 120 goto :waitloop

echo       [WARN] backend not ready after 120s
echo              check the ZhipaoBackend window
goto :frontend

:backend_ok
echo       backend ready

REM ==================== 4. frontend ====================
:frontend
echo.
echo [4/4] Mini program

if not exist "%APP_DIR%\package.json" (
    echo       [WARN] mini program not found: %APP_DIR%
    goto :done
)

if not exist "%APP_DIR%\node_modules" (
    echo       dependencies missing, installing  ^(1-2 min^)...
    start "npm install" cmd /c "cd /d "%APP_DIR%" && "%NODE_HOME%\npm.cmd" install && echo. && echo install done && pause"
    echo       after install finishes, run this file again
    goto :done
)

echo       starting dev build  ^(watch mode^)...
start "ZhipaoMiniProgram" cmd /k "cd /d "%APP_DIR%" && "%NODE_HOME%\npm.cmd" run dev:mp-weixin"

echo       waiting for first build...
set /a W2=0
:waitloop2
ping -n 4 127.0.0.1 >nul
set /a W2+=4
if exist "%APP_DIR%\dist\dev\mp-weixin\app.json" goto :built
if %W2% lss 120 goto :waitloop2
echo       [WARN] build not finished, check the ZhipaoMiniProgram window
goto :done

:built
echo       build ready

:done
echo.
echo ============================================================
echo                       READY
echo ============================================================
echo.
echo   Backend    : http://localhost:3000/api
echo   WeChat DevTools: import this folder
echo.
echo     %APP_DIR%\dist\dev\mp-weixin
echo.
echo   Windows opened
echo     ZhipaoBackend      - backend log  ^(do not close^)
echo     ZhipaoMiniProgram  - dev build    ^(do not close^)
echo.
echo   Login (dev mode)
echo     phone : 13800001234
echo     code  : printed in the ZhipaoBackend window
echo.
echo   Stop: run stop-admin.bat, or close those two windows
echo.
echo   NOTE: port 3000 is shared with AI Rhythm Guardian.
echo         Do not run both backends at the same time.
echo.
if not defined NO_PAUSE pause
exit /b 0

:abort
echo.
echo   Cancelled. The service on port 3000 was left running.
echo.
if not defined NO_PAUSE pause
exit /b 1

:fail
echo.
if not defined NO_PAUSE pause
exit /b 1
