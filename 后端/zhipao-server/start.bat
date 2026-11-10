@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM  Zhipao Campus - one click start
REM  MySQL check -> Redis start -> compile -> run backend -> wait ready
REM  Double click this file to start. Use stop.bat to stop.
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM ---------------- paths (edit if needed) ----------------
set "JDK_HOME=C:\Users\msr150174\.jdks\openjdk-25"
set "M2_REPO=C:\Users\msr150174\.m2\repository"
set "REDIS_DIR=D:\redis"
set "MYSQL_SERVICE=MYSQL80"
set "MAIN_CLASS=com.zhipao.ZhipaoApplication"
set "OUT_DIR=%SCRIPT_DIR%target\classes"
set "RES_DIR=%SCRIPT_DIR%src\main\resources"
set "LOG_DIR=%SCRIPT_DIR%logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo.
echo ============================================================
echo             Zhipao Campus - Starting
echo ============================================================
echo.

REM ---------------- 1. MySQL ----------------
echo [1/4] MySQL
sc query "%MYSQL_SERVICE%" 2>nul | findstr /i "RUNNING" >nul
if errorlevel 1 (
    echo       not running, starting service...
    net start "%MYSQL_SERVICE%" >nul 2>&1
    if errorlevel 1 (
        echo       [WARN] cannot start %MYSQL_SERVICE%
    ) else (
        echo       started
    )
) else (
    echo       running
)

REM ---------------- 2. Redis ----------------
echo.
echo [2/4] Redis
tasklist /fi "imagename eq redis-server.exe" 2>nul | findstr /i "redis-server.exe" >nul
if errorlevel 1 (
    if not exist "%REDIS_DIR%\redis-server.exe" (
        echo       [ERROR] not found: %REDIS_DIR%\redis-server.exe
        echo               edit REDIS_DIR at top of this file
        goto :fail
    )
    echo       starting...
    start "Redis" /min "%REDIS_DIR%\redis-server.exe" "%REDIS_DIR%\redis.windows.conf"
    ping -n 5 127.0.0.1 >nul
    "%REDIS_DIR%\redis-cli.exe" ping >nul 2>&1
    if errorlevel 1 (
        echo       [WARN] redis may not be ready
    ) else (
        echo       started
    )
) else (
    echo       running
)

REM ---------------- 3. compile ----------------
echo.
echo [3/4] Compile

if not exist "%JDK_HOME%\bin\javac.exe" (
    echo       [ERROR] JDK not found: %JDK_HOME%
    goto :fail
)

set "LOMBOK_JAR="
if exist "%M2_REPO%\org\projectlombok\lombok\1.18.48\lombok-1.18.48.jar" (
    set "LOMBOK_JAR=%M2_REPO%\org\projectlombok\lombok\1.18.48\lombok-1.18.48.jar"
)
if "%LOMBOK_JAR%"=="" (
    for /d %%d in ("%M2_REPO%\org\projectlombok\lombok\*") do (
        for %%f in ("%%d\lombok-*.jar") do set "LOMBOK_JAR=%%f"
    )
)
if "%LOMBOK_JAR%"=="" (
    echo       [ERROR] lombok jar not found
    goto :fail
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%build-helper.ps1" ^
  -M2Repo "%M2_REPO%" ^
  -SrcDir "%SCRIPT_DIR%src\main\java" ^
  -OutDir "%OUT_DIR%" ^
  -ResDir "%RES_DIR%" ^
  -LombokJar "%LOMBOK_JAR%" ^
  -TempDir "%TEMP%"

if errorlevel 1 (
    echo       [ERROR] classpath build failed
    goto :fail
)

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

echo       compiling...
"%JDK_HOME%\bin\javac.exe" "@%TEMP%\zhipao_javac.txt"
if errorlevel 1 (
    echo.
    echo       [ERROR] compile failed, see errors above
    goto :fail
)
echo       compile ok

REM ---------------- 4. run ----------------
echo.
echo [4/4] Start backend

REM ★ 不要用 `set /p` 读 classpath！
REM   `set /p` 在约 8KB 处静默截断，而本项目 classpath 有 27KB（264 个 jar），
REM   截断后会丢掉 target\classes 和后半截 jar，表现为：
REM     ClassNotFoundException: com.zhipao.ZhipaoApplication
REM   正确做法是生成 JVM 参数文件（@argfile），由 java 自己读取，没有长度限制。
powershell -NoProfile -Command ^
  "$cp = Get-Content -Raw '%TEMP%\zhipao_cp.txt'; $cp = $cp.Trim(); " ^
  "$arg = '-cp' + [Environment]::NewLine + '\"' + $cp + '\"'; " ^
  "[System.IO.File]::WriteAllText('%TEMP%\zhipao_run.txt', $arg, [System.Text.Encoding]::Default)"

if not exist "%TEMP%\zhipao_run.txt" (
    echo       [ERROR] failed to build run argfile
    goto :fail
)

start "ZhipaoBackend" /min cmd /c ""%JDK_HOME%\bin\java.exe" -Dfile.encoding=UTF-8 @%TEMP%\zhipao_run.txt %MAIN_CLASS% > "%LOG_DIR%\backend.log" 2>&1"

echo       waiting for ready...
set /a WAIT=0
:waitloop
ping -n 4 127.0.0.1 >nul
set /a WAIT+=3
powershell -NoProfile -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 3; if ($r.data.status) { exit 0 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :ready
if %WAIT% lss 60 goto :waitloop

echo       [WARN] not ready in 60s, check %LOG_DIR%\backend.log
goto :fail

:ready
echo.
echo ============================================================
echo                    STARTED OK
echo ============================================================
echo.
powershell -NoProfile -Command "try { $h = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 5; Write-Host ('   status : ' + $h.data.status); Write-Host ('   mysql  : ' + $h.data.mysql.connected + '  (' + $h.data.mysql.tables + ' tables)'); Write-Host ('   redis  : ' + $h.data.redis.connected); Write-Host ('   ai     : ' + $h.data.ai); Write-Host ('   procs  : ' + $h.data.procedures) } catch { Write-Host '   health check failed' }"
echo.
echo   api    : http://localhost:3000/api
echo   health : http://localhost:3000/api/health
echo   log    : %LOG_DIR%\backend.log
echo   stop   : run stop.bat
echo.
if not defined NO_PAUSE pause
exit /b 0

:fail
echo.
if not defined NO_PAUSE pause
exit /b 1
