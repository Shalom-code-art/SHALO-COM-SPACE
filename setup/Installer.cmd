@echo off
setlocal
title SHALO COM SPACE - Installation Windows
cd /d "%~dp0"

rem ===================================================================
rem  SHALO COM SPACE - point d'entree de l'installation Windows
rem  BATIANA TECH
rem
rem  Utilisation :
rem    Installer.cmd            assistant (menu)
rem    Installer.cmd /auto      installation par defaut, sans question
rem    Installer.cmd /silent    installation silencieuse (aucune fenetre finale)
rem    Installer.cmd /remove    desinstallation
rem ===================================================================

if /i "%~1"=="/auto" goto auto
if /i "%~1"=="/silent" goto auto
if /i "%~1"=="/remove" goto uninstall

rem --- demande des droits administrateur ---
net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo.
    echo   Elevation des privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
    exit /b
)

:menu
cls
echo.
echo   ============================================================
echo    SHALO COM SPACE - Assistant d'installation
echo    BATIANA TECH - plateforme de communication digitale
echo   ============================================================
echo.
echo    [1] Installer ou mettre a jour SHALO COM SPACE
echo    [2] Desinstaller SHALO COM SPACE
echo    [3] Verifier l'etat de l'installation
echo    [4] Ouvrir SHALO COM SPACE
echo    [0] Quitter
echo.
set "choix="
set /p "choix=Votre choix : "

if "%choix%"=="1" goto install
if "%choix%"=="2" goto uninstall
if "%choix%"=="3" goto status
if "%choix%"=="4" goto open
if "%choix%"=="0" exit /b
goto menu

:install
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-SHALO.ps1"
echo.
pause
goto menu

:uninstall
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-SHALO.ps1"
echo.
pause
goto menu

:status
cls
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$info = Join-Path '%~dp0' 'install.json';" ^
  "if (Test-Path $info) {" ^
  "  $j = Get-Content $info -Raw | ConvertFrom-Json;" ^
  "  Write-Host '  Version      :' $j.version;" ^
  "  Write-Host '  Application  :' $j.appDir;" ^
  "  Write-Host '  Donnees      :' $j.dataDir;" ^
  "  Write-Host '  Adresse      : http://localhost:'$j.port;" ^
  "  $task = Get-ScheduledTask -TaskName 'SHALO COM SPACE' -ErrorAction SilentlyContinue;" ^
  "  if ($task) { Write-Host '  Demarrage    : automatique (tache planifiee)' } else { Write-Host '  Demarrage    : manuel' };" ^
  "  try { $r = Invoke-WebRequest ('http://127.0.0.1:' + $j.port + '/login') -UseBasicParsing -TimeoutSec 5; Write-Host '  Etat serveur : en ligne (' $r.StatusCode ')' -ForegroundColor Green }" ^
  "  catch { Write-Host '  Etat serveur : hors ligne' -ForegroundColor Yellow }" ^
  "} else { Write-Host '  Aucune installation detectee dans ce dossier.' -ForegroundColor Yellow }"
echo.
pause
goto menu

:open
powershell -NoProfile -Command ^
  "$info = Join-Path '%~dp0' 'install.json';" ^
  "if (Test-Path $info) { $j = Get-Content $info -Raw | ConvertFrom-Json; Start-Process ('http://localhost:' + $j.port + '/') }" ^
  "else { Start-Process 'http://localhost:8080/' }"
goto menu

:auto
rem Installation sans question (archive auto-extractible ou deploiement groupe)
rem -NoBrowser : le navigateur est ouvert une seule fois, juste apres.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-SHALO.ps1" -Unattended -NoBrowser
if errorlevel 1 exit /b 1
if /i "%~1"=="/silent" exit /b 0
powershell -NoProfile -Command ^
  "$info = Join-Path '%~dp0' 'install.json';" ^
  "if (Test-Path $info) { $j = Get-Content $info -Raw | ConvertFrom-Json; Start-Process ('http://localhost:' + $j.port + '/setup') }" ^
  "else { Start-Process 'http://localhost:8080/setup' }"
exit /b 0
