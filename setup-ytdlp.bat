@echo off
setlocal
cd /d "%~dp0"
if not exist "tools" mkdir "tools"

echo Baixando o yt-dlp oficial para Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'tools\yt-dlp.exe'"

if errorlevel 1 (
  echo.
  echo ERRO: nao foi possivel baixar o yt-dlp.
  echo Verifique sua conexao com a internet e tente novamente.
  pause
  exit /b 1
)

echo.
echo yt-dlp instalado em tools\yt-dlp.exe
"tools\yt-dlp.exe" --version
if errorlevel 1 (
  echo O arquivo foi baixado, mas nao conseguiu ser executado.
  pause
  exit /b 1
)

echo.
echo Pronto. Reinicie o servidor com: npm start
pause
