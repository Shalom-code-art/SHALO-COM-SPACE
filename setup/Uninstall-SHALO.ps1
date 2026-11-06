<#
.SYNOPSIS
    Désinstalle SHALO COM SPACE de Windows.

.DESCRIPTION
    Arrête et supprime la tâche planifiée, retire les raccourcis, la règle de
    pare-feu et l'entrée « Applications et fonctionnalités », puis supprime les
    fichiers de l'application. Les données (base SQLite, journaux, sauvegardes)
    sont conservées par défaut : elles sont nécessaires pour réinstaller ou
    migrer l'instance. Utilisez -RemoveData pour les supprimer aussi.

.EXAMPLE
    .\Uninstall-SHALO.ps1

.EXAMPLE
    .\Uninstall-SHALO.ps1 -RemoveData

.EXAMPLE
    .\Uninstall-SHALO.ps1 -InstallDir "D:\Tests\SHALO\installed" -DataDir "D:\Tests\SHALO\installed\data-root" -RemoveData -Unattended
#>
[CmdletBinding()]
param(
    [string]$InstallDir,
    [string]$DataDir,
    [switch]$RemoveData,
    [switch]$Unattended,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$AppName = "SHALO COM SPACE"
$TaskName = "SHALO COM SPACE"

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

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not $InstallDir) { $InstallDir = $PSScriptRoot }
$installInfoPath = Join-Path $InstallDir "install.json"

if (-not (Test-Path $installInfoPath) -and -not $Force) {
    Write-Host ""
    Write-Host "  Aucune installation detectee dans : $InstallDir" -ForegroundColor Red
    Write-Host "  Le fichier install.json est absent. Utilisez -Force pour passer outre." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$info = $null
if (Test-Path $installInfoPath) {
    try { $info = Get-Content $installInfoPath -Raw | ConvertFrom-Json } catch { $info = $null }
}

if (-not $DataDir) {
    $DataDir = if ($info -and $info.dataDir) { $info.dataDir } else { Join-Path $env:ProgramData $AppName }
}
$Port = if ($info -and $info.port) { [int]$info.port } else { 8080 }
$isPortable = [bool]($info -and $info.portable)

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Write-Host "   SHALO COM SPACE - desinstallation" -ForegroundColor White
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Write-Host "   Application : $InstallDir"
Write-Host "   Donnees     : $DataDir"

if (-not (Test-Administrator) -and -not $isPortable) {
    Write-Host ""
    Write-Host "  Droits administrateur requis. Relancez via 'Desinstaller.cmd'." -ForegroundColor Red
    exit 1
}

if (-not $Unattended -and -not $RemoveData) {
    Write-Host ""
    $answer = Read-Host "  Supprimer aussi les donnees (base, journaux, sauvegardes) ? [o/N]"
    if (-not [string]::IsNullOrWhiteSpace($answer) -and $answer.Trim().ToLowerInvariant().StartsWith("o")) {
        $RemoveData = $true
    }
}

# ------------------------------------------------------------------ 1. service

Write-Step "1/5 - Arret du service"
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Ok "Tache planifiee supprimee."
} else {
    Write-Info "Aucune tache planifiee enregistree."
}

try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    if ($connections) { Write-Ok "Processus restants arretes (port $Port)." }
} catch {
    Write-Info "Verification du port $Port ignoree."
}

# ------------------------------------------------------------------ 2. systeme

Write-Step "2/5 - Nettoyage du systeme"
Remove-NetFirewallRule -DisplayName "$AppName (port $Port)" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "$AppName (port*)" -ErrorAction SilentlyContinue
Write-Ok "Regles de pare-feu retirees."

$uninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SHALO_COM_SPACE"
if (Test-Path $uninstallKey) {
    Remove-Item $uninstallKey -Recurse -Force
    Write-Ok "Entree 'Applications et fonctionnalites' retiree."
}

$startMenu = Join-Path $env:ProgramData ("Microsoft\Windows\Start Menu\Programs\" + $AppName)
if (Test-Path $startMenu) {
    Remove-Item $startMenu -Recurse -Force
    Write-Ok "Raccourcis du menu Demarrer supprimes."
}

# Raccourci du bureau : dossier commun et, par securite, bureau de l'utilisateur
foreach ($desktopFolder in @([Environment]::GetFolderPath("CommonDesktopDirectory"), [Environment]::GetFolderPath("Desktop"))) {
    if (-not $desktopFolder) { continue }
    foreach ($shortcutName in @("$AppName.lnk", "$AppName.url")) {
        $shortcutPath = Join-Path $desktopFolder $shortcutName
        if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue }
    }
}
Write-Ok "Raccourcis du bureau supprimes."

# ------------------------------------------------------------------ 3. fichiers

Write-Step "3/5 - Suppression des fichiers"
$appDir = Join-Path $InstallDir "app"
$installerDir = $PSScriptRoot

# En mode portable, les donnees sont placees DANS le dossier d'installation :
# supprimer ce dossier reviendrait a effacer les donnees. On ne le fait donc
# que si l'utilisateur a demande -RemoveData.
$dataInsideInstall = $DataDir.TrimEnd('\').StartsWith($InstallDir.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)
$hadData = Test-Path $DataDir
$targets = @($appDir)
if (-not $dataInsideInstall -or $RemoveData) { $targets += $InstallDir }

foreach ($target in $targets) {
    if (-not (Test-Path $target)) { continue }
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        try {
            Remove-Item $target -Recurse -Force -ErrorAction Stop
            break
        } catch {
            Start-Sleep -Seconds 2
            if ($attempt -eq 5) {
                Write-Host "    Suppression partielle de $target (fichiers verrouilles)." -ForegroundColor Yellow
            }
        }
    }
}
if ($targets -contains $InstallDir) {
    Write-Ok "Application supprimee."
} else {
    Write-Ok "Application supprimee ; dossier conserve car il contient les donnees."
}

# ------------------------------------------------------------------ 4. donnees

Write-Step "4/5 - Donnees"
if ($RemoveData) {
    if (Test-Path $DataDir) {
        Remove-Item $DataDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok "Donnees supprimees ($DataDir)."
    } elseif ($hadData) {
        Write-Ok "Donnees supprimees avec le dossier d'installation."
    } else {
        Write-Info "Aucun dossier de donnees."
    }
    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Info "Donnees conservees : $DataDir"
    Write-Info "Supprimez ce dossier manuellement si vous ne souhaitez plus les conserver."
}

# ------------------------------------------------------------------ 5. fin

Write-Step "5/5 - Fin"
# Etat copie a cote de l'installeur (Installer.cmd) : il n'est plus valable.
$launcherState = Join-Path $PSScriptRoot "install.json"
if ((Test-Path $launcherState) -and ($PSScriptRoot -ne $InstallDir)) {
    Remove-Item $launcherState -Force -ErrorAction SilentlyContinue
}
if (Test-Path $installerDir) {
    Write-Info "Le dossier de l'installeur peut etre supprime : $installerDir"
}

Write-Host ""
Write-Host "  $AppName a ete desinstalle." -ForegroundColor Green
Write-Host ""
