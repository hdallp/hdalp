@echo off
title HDALP Studio - Servidor :7878
cd /d "%~dp0"

echo ========================================================
echo   HDALP STUDIO - SERVIDOR LOCAL E EM REDE
echo ========================================================
echo.
echo   Porta: 7878
echo.
echo   - Acesso Local:     http://localhost:7878
echo   - 3D Splat Viewer:  http://localhost:7878/private/splat/
echo.
echo   Abrindo navegador padrao...
echo.
echo   Para encerrar o servidor, feche esta janela ou aperte Ctrl+C
echo ========================================================
echo.

:: Abre a rota no navegador padrao
start "" http://localhost:7878/private/splat/

:: Inicia o servidor HTTP acessivel na rede local (0.0.0.0) na porta 7878
python -m http.server 7878 --bind 0.0.0.0

pause
