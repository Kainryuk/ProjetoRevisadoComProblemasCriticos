@echo off
REM Script para iniciar o sistema Microblog
REM Inicia user-api e post-api em paralelo

echo.
echo ============================================================
echo   🚀 Iniciando Microblog - User API e Post API
echo ============================================================
echo.

REM Iniciar em new terminals (PowerShell)
start powershell -NoExit -Command "cd user-api; npm start"
timeout /t 3 /nobreak
start powershell -NoExit -Command "cd post-api; npm start"

echo.
echo ============================================================
echo   ✅ Serviços iniciados!
echo ============================================================
echo.
echo   User API:  http://localhost:8080
echo   Post API:  http://localhost:8081
echo.
echo   Use Ctrl+C em cada terminal para parar os serviços
echo.
