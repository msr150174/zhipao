@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================================
REM  智跑校园 · 后端一键启动脚本
REM ----------------------------------------------------------------------------
REM  作用：
REM    1. 自动用 javac 编译源码（含 Lombok 注解处理）
REM    2. 自动拼装依赖 classpath
REM    3. 启动 Spring Boot
REM
REM  用法：双击本文件，或在命令行执行 run.bat
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM ---------- 路径配置（按需修改）----------
set "JDK_HOME=C:\Users\msr150174\.jdks\openjdk-25"
set "M2_REPO=C:\Users\msr150174\.m2\repository"
set "MAIN_CLASS=com.zhipao.ZhipaoApplication"
set "OUT_DIR=%SCRIPT_DIR%target\classes"

echo.
echo ============================================================
echo   智跑校园 · 后端启动
echo ============================================================
echo.

REM ---------- 1. 检查 JDK ----------
if not exist "%JDK_HOME%\bin\javac.exe" (
    echo [错误] 找不到 JDK: %JDK_HOME%
    echo        请修改本脚本顶部的 JDK_HOME 变量
    pause
    exit /b 1
)
echo [1/4] JDK 检查通过
echo       %JDK_HOME%

REM ---------- 2. 检查 Maven 仓库 ----------
if not exist "%M2_REPO%" (
    echo [错误] 找不到 Maven 仓库: %M2_REPO%
    pause
    exit /b 1
)
echo [2/4] Maven 仓库存在

REM ---------- 3. 编译源码 ----------
echo [3/4] 正在编译...

REM 找出 Lombok jar（优先 1.18.48，否则取最新）
set "LOMBOK_JAR="
for %%f in ("%M2_REPO%\org\projectlombok\lombok\1.18.48\lombok-1.18.48.jar") do (
    if exist %%f set "LOMBOK_JAR=%%f"
)
if "%LOMBOK_JAR%"=="" (
    echo [警告] 未找到 Lombok 1.18.48，尝试搜索其他版本...
    for /d %%d in ("%M2_REPO%\org\projectlombok\lombok\*") do (
        for %%f in ("%%d\lombok-*.jar") do (
            echo %%~nf | findstr /i "sources javadoc" >nul || set "LOMBOK_JAR=%%f"
        )
    )
)
if "%LOMBOK_JAR%"=="" (
    echo [错误] 找不到 Lombok jar
    pause
    exit /b 1
)
echo       Lombok: %LOMBOK_JAR%

REM 生成依赖 classpath（用 PowerShell 拼接，避免命令行过长）
set "CP_FILE=%TEMP%\zhipao_cp.txt"
set "SRC_FILE=%TEMP%\zhipao_src.txt"
set "ARG_FILE=%TEMP%\zhipao_javac_args.txt"

powershell -NoProfile -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$jars = Get-ChildItem '%M2_REPO%' -Recurse -File -Filter *.jar | Where-Object { $_.Name -notmatch 'sources|javadoc' };" ^
  "$cp = ($jars | ForEach-Object { $_.FullName }) -join ';';" ^
  "[System.IO.File]::WriteAllText('%CP_FILE%', $cp, [System.Text.Encoding]::UTF8);" ^
  "$srcs = Get-ChildItem '%SCRIPT_DIR%src\main\java' -Recurse -File -Filter *.java | ForEach-Object { $_.FullName };" ^
  "[System.IO.File]::WriteAllLines('%SRC_FILE%', $srcs, [System.Text.Encoding]::UTF8);" ^
  "Write-Host ('      依赖 jar: ' + $jars.Count + ' 个');" ^
  "Write-Host ('      源文件:   ' + $srcs.Count + ' 个');"

if not exist "%CP_FILE%" (
    echo [错误] classpath 生成失败
    pause
    exit /b 1
)

REM 生成 javac 参数文件
powershell -NoProfile -Command ^
  "$cp = [System.IO.File]::ReadAllText('%CP_FILE%');" ^
  "$srcs = [System.IO.File]::ReadAllLines('%SRC_FILE%');" ^
  "$out = '%OUT_DIR%'.Replace('\','/');" ^
  "$lombok = '%LOMBOK_JAR%'.Replace('\','/');" ^
  "$lines = New-Object System.Collections.Generic.List[string];" ^
  "$lines.Add('-encoding'); $lines.Add('UTF-8');" ^
  "$lines.Add('-nowarn');" ^
  "$lines.Add('-cp'); $lines.Add('\"' + ($cp.Replace('\','/')) + '\"');" ^
  "$lines.Add('-processorpath'); $lines.Add('\"' + $lombok + '\"');" ^
  "$lines.Add('-d'); $lines.Add('\"' + $out + '\"');" ^
  "foreach ($s in $srcs) { $lines.Add('\"' + ($s.Replace('\','/')) + '\"') };" ^
  "[System.IO.File]::WriteAllLines('%ARG_FILE%', $lines, (New-Object System.Text.UTF8Encoding($false)));"

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

"%JDK_HOME%\bin\javac.exe" "@%ARG_FILE%"
if errorlevel 1 (
    echo.
    echo [错误] 编译失败，请看上面的错误信息
    pause
    exit /b 1
)
echo       编译成功

REM ---------- 4. 启动 ----------
echo [4/4] 正在启动 Spring Boot...
echo.
echo ------------------------------------------------------------
echo   启动后访问: http://localhost:3000/api/health
echo   停止服务:   按 Ctrl+C
echo ------------------------------------------------------------
echo.

REM classpath = 编译产物 + 资源目录 + 全部依赖
powershell -NoProfile -Command ^
  "$cp = [System.IO.File]::ReadAllText('%CP_FILE%');" ^
  "$full = '%OUT_DIR%' + ';' + '%SCRIPT_DIR%src\main\resources' + ';' + $cp;" ^
  "[System.IO.File]::WriteAllText('%TEMP%\zhipao_run_cp.txt', $full, [System.Text.Encoding]::UTF8);"

set /p RUN_CP=<"%TEMP%\zhipao_run_cp.txt"

"%JDK_HOME%\bin\java.exe" -Dfile.encoding=UTF-8 -cp "%RUN_CP%" %MAIN_CLASS%

echo.
echo 服务已停止
pause
