@echo off
chcp 65001 >nul
setlocal
title 智跑校园 · 停止服务

REM ============================================================================
REM  智跑校园 · 停止脚本
REM ----------------------------------------------------------------------------
REM  停止后端 Java 进程（默认保留 Redis 与 MySQL）
REM ============================================================================

REM 停止进程不需要路径，此处不设置 REDIS_DIR（避免与实际安装位置不一致）

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║              智跑校园 · 停止服务                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM ---------------- ① 停止后端 ----------------
echo [1/2] 停止后端...

set FOUND=0
for /f "tokens=2" %%p in ('tasklist /fi "imagename eq java.exe" /fo list 2^>nul ^| findstr /i "PID:"') do (
    echo       结束 Java 进程 PID=%%p
    taskkill /f /pid %%p >nul 2>&1
    set FOUND=1
)

if "%FOUND%"=="0" (
    echo       没有运行中的后端进程
) else (
    echo       后端已停止
)

REM ---------------- ② 询问是否停 Redis ----------------
echo.
echo [2/2] Redis 处理

choice /c YN /m "      是否也停止 Redis（选 N 则保留，推荐）"
if errorlevel 2 goto :keepredis

taskkill /f /im redis-server.exe >nul 2>&1
if errorlevel 1 (
    echo       Redis 未在运行
) else (
    echo       Redis 已停止
)
goto :done

:keepredis
echo       已保留 Redis 运行

:done
echo.
echo   注意: MySQL 是 Windows 服务，未受影响
echo         如需停止: net stop MYSQL80
echo.
pause
