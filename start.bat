@echo off
REM ============================================================
REM  MapFI - Lanzador de 1 clic para Windows
REM  Levanta toda la plataforma con Docker Compose.
REM ============================================================

echo.
echo   ============================================
echo    MapFI - Plataforma de Mapeo FI
echo   ============================================
echo.

REM Verificar que exista .env; si no, copiar desde el ejemplo.
if not exist ".env" (
  echo  [info] No se encontro .env. Copiando desde .env.example...
  copy ".env.example" ".env" >nul
  echo  [accion requerida] Edita .env y completa SESSION_SECRET antes de produccion.
  echo.
)

REM Verificar Docker.
where docker >nul 2>nul
if %errorlevel%==0 (
  echo  [ok] Docker detectado. Levantando contenedores...
  echo.
  docker compose up --build
  goto :eof
)

echo  [error] No se encontro Docker.
echo  Instala Docker Desktop o corre manualmente:
echo      npm install ^&^& npm run db:migrate ^&^& npm start
echo.
pause
