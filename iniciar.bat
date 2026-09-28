@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo        CONVERSOR LOCAL DE MIDIAS
echo ========================================
echo.

if not exist "node_modules\express" (
  echo Dependencias nao encontradas. Instalando...
  call npm ci
  if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

if not exist "tools\yt-dlp.exe" (
  echo yt-dlp nao encontrado localmente.
  echo Para downloads de redes sociais, execute setup-ytdlp.bat uma vez.
  echo.
)

call npm run check
if errorlevel 1 (
  echo.
  echo A verificacao encontrou um problema.
  pause
  exit /b 1
)

echo.
echo Iniciando servidor...
call npm start
pause
