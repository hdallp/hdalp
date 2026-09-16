@echo off
title EmojiCloud Effect Lab - 3D Gaussian Splat
cd /d "%~dp0"

echo ===================================================
echo         Iniciando EmojiCloud Effect Lab
echo ===================================================
echo.

set "PORT=8080"
set "OPERA_GX=%LOCALAPPDATA%\Programs\Opera GX\opera.exe"

:: Abre o navegador (Opera GX ou navegador padrao)
echo Abrindo em http://localhost:%PORT% ...
if exist "%OPERA_GX%" (
    start "" "%OPERA_GX%" "http://localhost:%PORT%"
) else (
    start "" "http://localhost:%PORT%"
)

:: Inicia o servidor local usando Node.js ou Python
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Iniciando servidor local via Node.js...
    echo Para encerrar o servidor, pressione Ctrl+C ou feche esta janela.
    echo.
    node server.js
    exit /b
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Iniciando servidor local via Python...
    echo Para encerrar o servidor, pressione Ctrl+C ou feche esta janela.
    echo.
    python -m http.server %PORT%
    exit /b
)

echo [AVISO] Nem Node.js nem Python foram detectados.
echo Abrindo diretamente o arquivo HTML...
start "" "index.html"
pause
