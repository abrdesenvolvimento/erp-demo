@echo off
title ABRWF Print Agent v3.0
cd /d "%~dp0"
echo Iniciando ABRWF Print Agent v3.0...
echo.
node print-agent.js
if errorlevel 1 (
    echo.
    echo [ERRO] O Print Agent encerrou com erro.
    echo Verifique se o Node.js esta instalado: node --version
    echo.
)
pause
