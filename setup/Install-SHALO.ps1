<#
.SYNOPSIS
    Installe SHALO COM SPACE sur Windows (application + service + raccourcis).

.DESCRIPTION
    Copie l'application compilée, prépare le dossier de données, applique les
    migrations SQL, enregistre le démarrage automatique (tâche planifiée),
    crée les raccourcis et ouvre le navigateur sur la page d'installation.

    L'installeur est idempotent : relancé sur une installation existante, il met
    à jour les fichiers de l'application sans toucher aux données ni au secret
    applicatif (nécessaire au déchiffrement des clés stockées).

.PARAMETER InstallDir
    Dossier d'installation. Par défaut : C:\Program Files\SHALO COM SPACE.

.PARAMETER DataDir
    Dossier des données (base SQLite, journaux). Par défaut : C:\ProgramData\SHALO COM SPACE.

.PARAMETER Port
    Port HTTP local. Par défaut : 8080.

.PARAMETER Lan
    Expose l'application aux autres postes du réseau local (écoute 0.0.0.0 + règle pare-feu).

.PARAMETER NoService
    N'enregistre pas le démarrage automatique (démarrage manuel).

.PARAMETER NoShortcuts
    Ne crée aucun raccourci (menu Démarrer, bureau).

.PARAMETER NoFirewall
    N'ajoute aucune règle de pare-feu.

.PARAMETER NoBrowser
    N'ouvre pas le navigateur à la fin de l'installation.

.PARAMETER Portable
    Mode dossier : aucune modification du système (pas de service, ni pare-feu,
    ni registre, ni raccourcis). Utile pour les tests et les clés USB.

.PARAMETER Unattended
    Aucune question posée (les valeurs par défaut ou les paramètres priment).

.EXAMPLE
    .\Install-SHALO.ps1

.EXAMPLE
    .\Install-SHALO.ps1 -Port 9000 -Lan

.EXAMPLE
    .\Install-SHALO.ps1 -Portable -InstallDir D:\Tests\SHALO -NoBrowser -Unattended
#>
[CmdletBinding()]
param(
    [string]$InstallDir,
    [string]$DataDir,
    [int]$Port = 8080,
    [switch]$Lan,
    [switch]$NoService,
    [switch]$NoShortcuts,
    [switch]$NoFirewall,
    [switch]$NoBrowser,
    [switch]$Portable,
    [switch]$Unattended,
    [switch]$KeepExistingConfig
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$TaskName = "SHALO COM SPACE"
$AppName = "SHALO COM SPACE"
$Publisher = "BATIANA TECH"

if ($Portable) {
    $NoService = $true
    $NoShortcuts = $true
    $NoFirewall = $true
}

# ------------------------------------------------------------------ affichage

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "  > $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "    $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "    $Message" -ForegroundColor Gray
}

function Fail {
    param([string]$Message, [string]$Hint)
    Write-Host ""
    Write-Host "  Installation interrompue : $Message" -ForegroundColor Red
    if ($Hint) { Write-Host "  $Hint" -ForegroundColor Yellow }
    Write-Host ""
    exit 1
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ask-YesNo {
    param([string]$Question, [bool]$Default = $true)
    if ($Unattended) { return $Default }
    $suffix = if ($Default) { "[O/n]" } else { "[o/N]" }
    $answer = Read-Host "    $Question $suffix"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer.Trim().ToLowerInvariant().StartsWith("o")
}

function Get-NodeVersion {
    param([string]$NodePath)
    try {
        $raw = & $NodePath -p "process.versions.node" 2>$null
        if (-not $raw) { return $null }
        $match = [regex]::Match($raw.Trim(), '^(\d+)\.(\d+)\.(\d+)')
        if (-not $match.Success) { return $null }
        return [version]("{0}.{1}.{2}" -f $match.Groups[1].Value, $match.Groups[2].Value, $match.Groups[3].Value)
    } catch {
        return $null
    }
}

function Invoke-Robocopy {
    param([string]$Source, [string]$Destination, [string]$Label)
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $arguments = @("`"$Source`"", "`"$Destination`"", "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/R:1", "/W:1", "/NP")
    $process = Start-Process -FilePath "robocopy.exe" -ArgumentList $arguments -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ge 8) {
        Fail "la copie de $Label a echoue (code robocopy $($process.ExitCode))."
    }
}

# ------------------------------------------------------------------ 1. contexte

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Write-Host "   SHALO COM SPACE - installation Windows" -ForegroundColor White
Write-Host "   $Publisher - plateforme de communication digitale" -ForegroundColor DarkGray
Write-Host "  ============================================================" -ForegroundColor DarkBlue

$isAdmin = Test-Administrator
if (-not $isAdmin -and -not $Portable) {
    Fail "les droits administrateur sont necessaires." "Relancez l'installation avec 'Installer.cmd' (invite d'elevation automatique)."
}

if (-not $InstallDir) {
    $InstallDir = if ($Portable) { Join-Path $PSScriptRoot "installed" } else { Join-Path $env:ProgramFiles $AppName }
}
if (-not $DataDir) {
    $DataDir = if ($Portable) { Join-Path $InstallDir "data-root" } else { Join-Path $env:ProgramData $AppName }
}

$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
$DataDir = [System.IO.Path]::GetFullPath($DataDir)
$AppDir = Join-Path $InstallDir "app"
$RuntimeDir = Join-Path $InstallDir "runtime"
$DbDir = Join-Path $DataDir "data"
$LogDir = Join-Path $DataDir "logs"
$DbPath = Join-Path $DbDir "shalo.db"
$ConfigPath = Join-Path $InstallDir "config.cmd"
$VersionFile = Join-Path $PSScriptRoot "version.txt"

$Version = "1.0.0"
if (Test-Path $VersionFile) {
    $candidate = (Get-Content $VersionFile -TotalCount 1).Trim()
    if ($candidate -match '^\d+\.\d+\.\d+') { $Version = $candidate }
}

Write-Step "1/8 - Verification de l'environnement"
Write-Info "Dossier d'installation : $InstallDir"
Write-Info "Dossier des donnees    : $DataDir"
Write-Info "Version                : $Version"

# ------------------------------------------------------------------ 2. sources

Write-Step "2/8 - Preparation des fichiers"
$sourceRoot = $PSScriptRoot
$payloadZip = Join-Path $PSScriptRoot "payload.zip"
$cleanupSource = $false

if (Test-Path $payloadZip) {
    $extractDir = Join-Path $env:TEMP ("shalo-payload-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
    Write-Info "Extraction de l'archive d'installation..."
    Expand-Archive -Path $payloadZip -DestinationPath $extractDir -Force
    $sourceRoot = $extractDir
    $cleanupSource = $true
}

$payloadApp = Join-Path $sourceRoot "payload\app"
if (-not (Test-Path $payloadApp)) { $payloadApp = Join-Path $sourceRoot "app" }
$payloadRuntime = Join-Path $sourceRoot "payload\runtime"
if (-not (Test-Path $payloadRuntime)) { $payloadRuntime = Join-Path $sourceRoot "runtime" }
$payloadIcon = Join-Path $sourceRoot "payload\shalo.ico"
if (-not (Test-Path $payloadIcon)) { $payloadIcon = Join-Path $sourceRoot "shalo.ico" }

if (-not (Test-Path (Join-Path $payloadApp "server.js"))) {
    Fail "les fichiers de l'application sont introuvables." "Le dossier 'payload' est incomplet : recompilez l'installeur avec setup\Build-Installer.ps1."
}
Write-Ok "Fichiers de l'application trouves."

# ------------------------------------------------------------------ 3. Node.js

Write-Step "3/8 - Recherche du moteur d'execution Node.js"
$bundledNode = Join-Path $payloadRuntime "node.exe"
$nodeExe = $null
$nodeSource = ""

if (Test-Path $bundledNode) {
    $nodeExe = $bundledNode
    $nodeSource = "runtime embarque"
} else {
    $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($systemNode) {
        $nodeExe = $systemNode.Source
        $nodeSource = "Node.js installe sur le systeme"
    }
}

if (-not $nodeExe) {
    Fail "Node.js est introuvable." "Recompilez l'installeur avec -DownloadNode, ou installez Node.js 22.18+ depuis https://nodejs.org."
}

$nodeVersion = Get-NodeVersion -NodePath $nodeExe
if (-not $nodeVersion) {
    Fail "la version de Node.js n'a pas pu etre determinee ($nodeExe)."
}
if ($nodeVersion -lt [version]"22.18.0") {
    Fail "Node.js $nodeVersion est trop ancien." "SHALO COM SPACE requiert Node.js 22.18 ou superieur (24 LTS recommande)."
}
Write-Ok "Node.js $nodeVersion ($nodeSource)"

# ------------------------------------------------------------------ 4. copie

Write-Step "4/8 - Installation des fichiers"
if (Test-Path $AppDir) {
    Write-Info "Mise a jour de l'installation existante..."
}
Invoke-Robocopy -Source $payloadApp -Destination $AppDir -Label "l'application"
Write-Ok "Application installee dans $AppDir"

if (Test-Path $bundledNode) {
    Invoke-Robocopy -Source $payloadRuntime -Destination $RuntimeDir -Label "Node.js"
    $nodeExe = Join-Path $RuntimeDir "node.exe"
    $nodeSource = "runtime embarque"
    Write-Ok "Moteur Node.js embarque dans $RuntimeDir"
}

foreach ($tool in @("Install-SHALO.ps1", "Uninstall-SHALO.ps1", "README-INSTALLATION.md")) {
    $candidate = Join-Path $PSScriptRoot $tool
    if (Test-Path $candidate) {
        Copy-Item $candidate (Join-Path $InstallDir $tool) -Force
    }
}
if (Test-Path $payloadIcon) {
    Copy-Item $payloadIcon (Join-Path $InstallDir "shalo.ico") -Force
}

New-Item -ItemType Directory -Force -Path $DbDir, $LogDir, (Join-Path $DataDir "backups") | Out-Null
Write-Ok "Dossier de donnees pret ($DataDir)"

# ------------------------------------------------------------------ 5. configuration

Write-Step "5/8 - Configuration"
$portExplicit = $PSBoundParameters.ContainsKey("Port")
$lanExplicit = $PSBoundParameters.ContainsKey("Lan")
$appSecret = ""
$existingConfig = Test-Path $ConfigPath
if ($existingConfig) {
    $secretLine = Select-String -Path $ConfigPath -Pattern '^set "APP_SECRET=(.+)"$' | Select-Object -First 1
    if ($secretLine) { $appSecret = $secretLine.Matches[0].Groups[1].Value }
    Write-Info "Configuration existante conservee (secret applicatif preserve)."

    if (-not $portExplicit) {
        $portLine = Select-String -Path $ConfigPath -Pattern '^set "PORT=(\d+)"$' | Select-Object -First 1
        if ($portLine) { $Port = [int]$portLine.Matches[0].Groups[1].Value }
    }
    if (-not $lanExplicit) {
        $hostLine = Select-String -Path $ConfigPath -Pattern '^set "HOSTNAME=(.+)"$' | Select-Object -First 1
        if ($hostLine) { $Lan = $hostLine.Matches[0].Groups[1].Value.Trim() -eq "0.0.0.0" }
    }
}

if (-not $appSecret) {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($bytes)
    $generator.Dispose()
    $appSecret = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    Write-Ok "Secret applicatif genere (chiffrement des cles stockees)."
}

if ($existingConfig -and -not $KeepExistingConfig -and -not $Unattended -and -not $Portable) {
    if (-not (Ask-YesNo "Conserver le port et l'exposition reseau actuels ?" $true)) {
        $answer = Read-Host "    Nouveau port HTTP [$Port]"
        $parsed = 0
        if ([int]::TryParse($answer.Trim(), [ref]$parsed) -and $parsed -ge 1024 -and $parsed -le 65535) { $Port = $parsed }
        $Lan = Ask-YesNo "Rendre l'application accessible aux autres postes du reseau local ?" $false
    }
}

if (-not $Unattended -and -not $Portable -and -not $existingConfig) {
    Write-Info "Appuyez sur Entree pour accepter les valeurs proposees."
    $answer = Read-Host "    Port HTTP [$Port]"
    if (-not [string]::IsNullOrWhiteSpace($answer)) {
        $parsed = 0
        if ([int]::TryParse($answer.Trim(), [ref]$parsed) -and $parsed -ge 1024 -and $parsed -le 65535) { $Port = $parsed }
    }
    $Lan = Ask-YesNo "Rendre l'application accessible aux autres postes du reseau local ?" $false
}

$hostname = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$appUrl = "http://localhost:$Port"
$nodeRelative = if ($nodeSource -eq "runtime embarque") { "%~dp0runtime\node.exe" } else { "node" }

$configLines = @(
    "@echo off",
    "rem Configuration de SHALO COM SPACE - genere par l'installeur le $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
    "rem Conservez APP_SECRET : il dechiffre les cles API et integrations enregistrees.",
    "set `"NODE_ENV=production`"",
    "set `"PORT=$Port`"",
    "set `"HOSTNAME=$hostname`"",
    "set `"APP_SECRET=$appSecret`"",
    "set `"APP_URL=$appUrl`"",
    "set `"DATABASE_PATH=$DbPath`"",
    "set `"SHALO_LOG_DIR=$LogDir`"",
    "set `"SHALO_VERSION=$Version`""
)
Set-Content -Path $ConfigPath -Value $configLines -Encoding ASCII
Write-Ok "Configuration ecrite dans config.cmd"

# Scripts de service (ASCII : compatibles toutes consoles Windows)
$runServer = @(
    "@echo off",
    "setlocal",
    "cd /d `"%~dp0`"",
    "call `"%~dp0config.cmd`"",
    "if not exist `"%SHALO_LOG_DIR%`" mkdir `"%SHALO_LOG_DIR%`"",
    "echo [%DATE% %TIME%] demarrage du serveur sur le port %PORT% >> `"%SHALO_LOG_DIR%\service.log`"",
    "`"$nodeRelative`" `"app\server.js`" >> `"%SHALO_LOG_DIR%\server.log`" 2>&1",
    "echo [%DATE% %TIME%] arret du serveur (code %ERRORLEVEL%) >> `"%SHALO_LOG_DIR%\service.log`""
)
Set-Content -Path (Join-Path $InstallDir "run-server.cmd") -Value $runServer -Encoding ASCII

$runHidden = @(
    "' Demarre le serveur sans afficher de fenetre (utilise par la tache planifiee).",
    "Set fso = CreateObject(`"Scripting.FileSystemObject`")",
    "Set shell = CreateObject(`"WScript.Shell`")",
    "folder = fso.GetParentFolderName(WScript.ScriptFullName)",
    "shell.Run `"cmd.exe /c `"`"`" & folder & `"\run-server.cmd`"`"`"`", 0, False"
)
Set-Content -Path (Join-Path $InstallDir "run-server.vbs") -Value $runHidden -Encoding ASCII

# Lanceur silencieux du raccourci : demarre le serveur s'il ne repond pas
# encore, attend la disponibilite puis ouvre le navigateur. Aucune fenetre
# noire n'apparait, comme pour un logiciel Windows classique.
$openAppTemplate = @'
' SHALO COM SPACE - ouvre l'application dans le navigateur, sans fenetre.
' Demarre le serveur si necessaire, attend qu'il reponde puis ouvre l'adresse.
Option Explicit

Dim shell, folder, probe, url, ready, useService
Set shell = CreateObject("WScript.Shell")
folder = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
probe = "http://127.0.0.1:__PORT__/"
url = "http://localhost:__PORT__/"
useService = __SERVICE__

ready = IsUp(probe)
If Not ready Then
    If useService Then
        shell.Run "schtasks /Run /TN ""__TASK__""", 0, False
        ready = WaitUp(probe, 20)
    End If
End If
If Not ready Then
    shell.Run "cmd.exe /c """ & folder & "run-server.cmd""", 0, False
    ready = WaitUp(probe, 40)
End If

shell.Run url, 1, False

Function IsUp(target)
    Dim request
    IsUp = False
    On Error Resume Next
    Set request = CreateObject("MSXML2.ServerXMLHTTP")
    request.setTimeouts 1500, 1500, 1500, 1500
    request.Open "GET", target, False
    request.Send
    If Err.Number = 0 Then
        IsUp = (request.Status >= 200) And (request.Status < 500)
    End If
    On Error GoTo 0
End Function

Function WaitUp(target, seconds)
    Dim i
    WaitUp = False
    For i = 1 To seconds
        WScript.Sleep 1000
        If IsUp(target) Then
            WaitUp = True
            Exit Function
        End If
    Next
End Function
'@
$serviceText = if ($NoService) { "False" } else { "True" }
$openApp = $openAppTemplate.Replace("__PORT__", "$Port").Replace("__TASK__", $TaskName).Replace("__SERVICE__", $serviceText)
Set-Content -Path (Join-Path $InstallDir "open-app.vbs") -Value $openApp -Encoding ASCII

$startServer = @(
    "@echo off",
    "setlocal",
    "cd /d `"%~dp0`"",
    "call `"%~dp0config.cmd`"",
    "if not exist `"shalo-service.flag`" goto manual",
    "schtasks /Run /TN `"$TaskName`" >nul 2>&1",
    "echo Le service SHALO COM SPACE demarre.",
    "timeout /t 3 >nul",
    "start `"`" `"http://localhost:%PORT%/`"",
    "exit /b 0",
    ":manual",
    "start `"SHALO COM SPACE`" /min cmd.exe /c `"`"%~dp0run-server.cmd`"`"",
    "echo SHALO COM SPACE demarre sur http://localhost:%PORT%/",
    "timeout /t 4 >nul",
    "start `"`" `"http://localhost:%PORT%/`""
)
Set-Content -Path (Join-Path $InstallDir "start-server.cmd") -Value $startServer -Encoding ASCII

$stopServer = @(
    "@echo off",
    "setlocal",
    "cd /d `"%~dp0`"",
    "call `"%~dp0config.cmd`"",
    "if exist `"shalo-service.flag`" (",
    "  schtasks /End /TN `"$TaskName`" >nul 2>&1",
    "  echo Service SHALO COM SPACE arrete.",
    "  exit /b 0",
    ")",
    "powershell -NoProfile -Command `"`$c = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if (`$c) { Stop-Process -Id `$c.OwningProcess -Force }`"",
    "echo SHALO COM SPACE arrete."
)
Set-Content -Path (Join-Path $InstallDir "stop-server.cmd") -Value $stopServer -Encoding ASCII

$uninstallLauncher = @(
    "@echo off",
    "title Desinstallation de SHALO COM SPACE",
    "net session >nul 2>&1",
    "if not `"%ERRORLEVEL%`"==`"0`" (",
    "  powershell -NoProfile -Command `"Start-Process -FilePath '%~f0' -Verb RunAs`"",
    "  exit /b",
    ")",
    "powershell -NoProfile -ExecutionPolicy Bypass -File `"%~dp0Uninstall-SHALO.ps1`"",
    "pause"
)
Set-Content -Path (Join-Path $InstallDir "Desinstaller.cmd") -Value $uninstallLauncher -Encoding ASCII
Write-Ok "Scripts de demarrage, d'arret et de desinstallation crees."

# ------------------------------------------------------------------ 6. migrations

Write-Step "6/8 - Preparation de la base de donnees"
$env:DATABASE_PATH = $DbPath
try {
    Push-Location $AppDir
    try {
        $migrationOutput = & $nodeExe "tools\migrate-standalone.mjs" 2>&1
        $migrationCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($migrationCode -ne 0) {
        Fail "les migrations SQL ont echoue." ($migrationOutput -join " ")
    }
    Write-Ok ($migrationOutput | Select-Object -Last 1)
} finally {
    $env:DATABASE_PATH = $null
}

# ------------------------------------------------------------------ 7. service

Write-Step "7/8 - Demarrage automatique et lancement"
if (-not $NoService) {
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + (Join-Path $InstallDir "run-server.vbs") + '"')
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
        -Description "Serveur web SHALO COM SPACE (port $Port). Demarrage automatique au boot." -Force | Out-Null
    Set-Content -Path (Join-Path $InstallDir "shalo-service.flag") -Value "service" -Encoding ASCII
    Write-Ok "Tache planifiee '$TaskName' enregistree (demarrage au boot, compte SYSTEM)."
    Start-ScheduledTask -TaskName $TaskName
} else {
    Remove-Item (Join-Path $InstallDir "shalo-service.flag") -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", ('"' + (Join-Path $InstallDir "run-server.cmd") + '"') -WindowStyle Hidden
    Write-Ok "Serveur lance en arriere-plan (demarrage manuel)."
}

$healthy = $false
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -UseBasicParsing -TimeoutSec 4
        if ($response.StatusCode -eq 200) { $healthy = $true; break }
    } catch {
        # le serveur demarre encore
    }
}

if ($healthy) {
    Write-Ok "Serveur disponible sur $appUrl"
} else {
    Write-Host "    Le serveur ne repond pas encore." -ForegroundColor Yellow
    Write-Host "    Consultez $LogDir\server.log" -ForegroundColor Yellow
}

# ------------------------------------------------------------------ 8. raccourcis

Write-Step "8/8 - Raccourcis et enregistrement"
if (-not $NoShortcuts) {
    $startMenu = Join-Path $env:ProgramData ("Microsoft\Windows\Start Menu\Programs\" + $AppName)
    New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
    $iconPath = Join-Path $InstallDir "shalo.ico"
    $launcher = Join-Path $InstallDir "open-app.vbs"
    $wscript = Join-Path $env:WINDIR "System32\wscript.exe"
    $shell = New-Object -ComObject WScript.Shell

    # Raccourci principal : open-app.vbs demarre le serveur si necessaire puis
    # ouvre le navigateur, sans fenetre intermediaire.
    $shortcut = $shell.CreateShortcut((Join-Path $startMenu "$AppName.lnk"))
    $shortcut.TargetPath = $wscript
    $shortcut.Arguments = '"' + $launcher + '"'
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Description = "Ouvre SHALO COM SPACE dans le navigateur"
    if (Test-Path $iconPath) { $shortcut.IconLocation = "$iconPath,0" }
    $shortcut.Save()

    $shortcut = $shell.CreateShortcut((Join-Path $startMenu "Arreter le service.lnk"))
    $shortcut.TargetPath = Join-Path $InstallDir "stop-server.cmd"
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Description = "Arrete SHALO COM SPACE"
    if (Test-Path $iconPath) { $shortcut.IconLocation = "$iconPath,0" }
    $shortcut.Save()

    $shortcut = $shell.CreateShortcut((Join-Path $startMenu "Desinstaller.lnk"))
    $shortcut.TargetPath = Join-Path $InstallDir "Desinstaller.cmd"
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Description = "Desinstalle SHALO COM SPACE"
    $shortcut.Save()

    # Bureau : dossier commun (visible par tous les comptes) ; a defaut, celui
    # de l'utilisateur qui installe. C'est le point d'entree pour les clients.
    $desktopFolder = [Environment]::GetFolderPath("CommonDesktopDirectory")
    if (-not $desktopFolder -or -not (Test-Path $desktopFolder)) {
        $desktopFolder = [Environment]::GetFolderPath("Desktop")
    }
    if ($desktopFolder -and (Test-Path $desktopFolder)) {
        $shortcut = $shell.CreateShortcut((Join-Path $desktopFolder "$AppName.lnk"))
        $shortcut.TargetPath = $wscript
        $shortcut.Arguments = '"' + $launcher + '"'
        $shortcut.WorkingDirectory = $InstallDir
        $shortcut.Description = "Ouvre SHALO COM SPACE dans le navigateur"
        if (Test-Path $iconPath) { $shortcut.IconLocation = "$iconPath,0" }
        $shortcut.Save()
        Write-Ok "Raccourci cree sur le bureau : $desktopFolder\$AppName.lnk"
    } else {
        Write-Host "    Bureau introuvable : raccourci cree seulement dans le menu Demarrer." -ForegroundColor Yellow
    }
    Write-Ok "Raccourcis du menu Demarrer crees."
} else {
    Write-Info "Raccourcis non demandes."
}

if (-not $Portable) {
    $uninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SHALO_COM_SPACE"
    $sizeKb = 0
    try {
        $sizeKb = [int]((Get-ChildItem $InstallDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1KB)
    } catch { }
    New-Item -Path $uninstallKey -Force | Out-Null
    Set-ItemProperty -Path $uninstallKey -Name "DisplayName" -Value $AppName
    Set-ItemProperty -Path $uninstallKey -Name "DisplayVersion" -Value $Version
    Set-ItemProperty -Path $uninstallKey -Name "Publisher" -Value $Publisher
    Set-ItemProperty -Path $uninstallKey -Name "DisplayIcon" -Value (Join-Path $InstallDir "shalo.ico")
    Set-ItemProperty -Path $uninstallKey -Name "InstallLocation" -Value $InstallDir
    Set-ItemProperty -Path $uninstallKey -Name "UninstallString" -Value ('"' + (Join-Path $InstallDir "Desinstaller.cmd") + '"')
    Set-ItemProperty -Path $uninstallKey -Name "NoModify" -Value 1 -Type DWord
    Set-ItemProperty -Path $uninstallKey -Name "NoRepair" -Value 1 -Type DWord
    Set-ItemProperty -Path $uninstallKey -Name "EstimatedSize" -Value $sizeKb -Type DWord
    Write-Ok "Entree 'Applications et fonctionnalites' enregistree."
}

if (-not $NoFirewall -and $Lan) {
    $ruleName = "SHALO COM SPACE (port $Port)"
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private -Description "Acces reseau local a SHALO COM SPACE" | Out-Null
    Write-Ok "Regle pare-feu ajoutee (profil prive, port $Port)."
}

$installInfo = [ordered]@{
    product = $AppName
    publisher = $Publisher
    version = $Version
    installedAt = (Get-Date).ToString("o")
    installDir = $InstallDir
    appDir = $AppDir
    dataDir = $DataDir
    databasePath = $DbPath
    logDir = $LogDir
    port = $Port
    lan = [bool]$Lan
    service = (-not $NoService)
    taskName = $TaskName
    nodePath = $nodeExe
    portable = [bool]$Portable
}
$installInfoJson = $installInfo | ConvertTo-Json -Depth 4
Set-Content -Path (Join-Path $InstallDir "install.json") -Value $installInfoJson -Encoding UTF8

# Copie a cote de l'installeur : Installer.cmd (etat, ouverture, mise a jour)
# lit ce fichier avant meme de connaitre le dossier d'installation.
if ($PSScriptRoot -ne $InstallDir) {
    try {
        Set-Content -Path (Join-Path $PSScriptRoot "install.json") -Value $installInfoJson -Encoding UTF8
    } catch {
        Write-Info "Etat non copie dans le dossier de l'installeur (droits insuffisants)."
    }
}

if ($cleanupSource) {
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
}

$env:DATABASE_PATH = $null

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Write-Host "   Installation terminee" -ForegroundColor Green
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Write-Host "   Adresse        : $appUrl"
Write-Host "   Application    : $AppDir"
Write-Host "   Donnees        : $DataDir"
Write-Host "   Journaux       : $LogDir"
Write-Host "   Demarrage auto : $(if ($NoService) { 'non (manuel)' } else { 'oui (tache planifiee)' })"
Write-Host ""
Write-Host "   Prochaine etape : ouvrez $appUrl/setup" -ForegroundColor Yellow
Write-Host "   pour creer le premier administrateur de la plateforme." -ForegroundColor Yellow
Write-Host ""

if (-not $NoBrowser -and -not $Unattended) {
    Start-Process "$appUrl/setup"
}
