<#
.SYNOPSIS
    Construit le paquet d'installation Windows de SHALO COM SPACE.

.DESCRIPTION
    Étapes :
      1. build de production (npm run build, sortie standalone) ;
      2. assemblage du dossier payload\ (application + migrations + runtime) ;
      3. génération de l'icône Windows à partir du logo ;
      4. archive ZIP distribuable (dossier à extraire, puis Installer.cmd) ;
      5. installeur auto-extractible .exe (compile avec le compilateur C#
         fourni par Windows, aucun outil a installer) ;
      6. installeur optionnel Inno Setup si ISCC est present.

.PARAMETER SkipBuild
    Réutilise le build existant de .next\standalone (gain de temps).

.PARAMETER DownloadNode
    Télécharge un Node.js LTS officiel et l'embarque : l'utilisateur final n'a
    alors rien à installer (paquet plus volumineux).

.PARAMETER NoZip
    N'assemble pas l'archive ZIP.

.PARAMETER NoExe
    Ne génère pas l'installeur auto-extractible .exe.

.PARAMETER Inno
    Compile également l'installeur Inno Setup (si Inno Setup 6 est installé).

.PARAMETER Version
    Version affichée et utilisée dans les noms de fichiers (sinon package.json).

.EXAMPLE
    .\Build-Installer.ps1 -DownloadNode
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$DownloadNode,
    [switch]$NoZip,
    [switch]$NoExe,
    [switch]$Inno,
    [string]$Version
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$SetupDir = $PSScriptRoot
$Root = Split-Path $SetupDir -Parent
$PayloadDir = Join-Path $SetupDir "payload"
$BuildDir = Join-Path $SetupDir "build"
$DistDir = Join-Path $SetupDir "dist"
$RuntimeDir = Join-Path $PayloadDir "runtime"

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
    param([string]$Message)
    Write-Host ""
    Write-Host "  Echec : $Message" -ForegroundColor Red
    Write-Host ""
    exit 1
}

function Invoke-Robocopy {
    param([string]$Source, [string]$Destination, [string]$Filter = "*.*")
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $arguments = @("`"$Source`"", "`"$Destination`"", $Filter, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/R:1", "/W:1", "/NP")
    $process = Start-Process -FilePath "robocopy.exe" -ArgumentList $arguments -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ge 8) { Fail "copie impossible depuis $Source (code $($process.ExitCode))." }
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Write-Host "   SHALO COM SPACE - construction du paquet Windows" -ForegroundColor White
Write-Host "  ============================================================" -ForegroundColor DarkBlue

# ------------------------------------------------------------------ version

if (-not $Version) {
    $packageJson = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json
    $Version = $packageJson.version
}
if (-not $Version -match '^\d+\.\d+\.\d+') { Fail "version invalide : $Version" }
Write-Info "Version : $Version"

# ------------------------------------------------------------------ build

Write-Step "1/7 - Build de production"
if ($SkipBuild) {
    Write-Info "Build existant reutilise (-SkipBuild)."
} else {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) { Fail "npm.cmd est introuvable dans le PATH." }
    Push-Location $Root
    try {
        & $npm.Source run build
        $buildCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($buildCode -ne 0) { Fail "le build a echoue (code $buildCode)." }
    Write-Ok "Build termine."
}

$standalone = Join-Path $Root ".next\standalone"
if (-not (Test-Path (Join-Path $standalone "server.js"))) {
    Fail "sortie standalone introuvable (.next\standalone\server.js) : lancez 'npm run build' sans -SkipBuild."
}

# ------------------------------------------------------------------ payload

Write-Step "2/7 - Assemblage du payload"
if (Test-Path $PayloadDir) { Remove-Item $PayloadDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $PayloadDir | Out-Null
$appPayload = Join-Path $PayloadDir "app"

Invoke-Robocopy -Source $standalone -Destination $appPayload
Invoke-Robocopy -Source (Join-Path $Root ".next\static") -Destination (Join-Path $appPayload ".next\static")
if (Test-Path (Join-Path $Root "public")) {
    Invoke-Robocopy -Source (Join-Path $Root "public") -Destination (Join-Path $appPayload "public")
}
Invoke-Robocopy -Source (Join-Path $Root "db") -Destination (Join-Path $appPayload "db")

$toolsDir = Join-Path $appPayload "tools"
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
Copy-Item (Join-Path $SetupDir "tools\migrate-standalone.mjs") $toolsDir -Force

# Les scripts d'installation accompagnent le paquet (réparation, désinstallation)
foreach ($script in @("Install-SHALO.ps1", "Uninstall-SHALO.ps1", "Installer.cmd")) {
    Copy-Item (Join-Path $SetupDir $script) $PayloadDir -Force
}
if (Test-Path (Join-Path $SetupDir "README.md")) {
    Copy-Item (Join-Path $SetupDir "README.md") (Join-Path $PayloadDir "README-INSTALLATION.md") -Force
}
Set-Content -Path (Join-Path $PayloadDir "version.txt") -Value $Version -Encoding ASCII
# version.txt a la racine de setup\ : lu par Install-SHALO.ps1 et inclus par le
# script Inno Setup (setup\inno\SHALO_COM_SPACE.iss).
Set-Content -Path (Join-Path $SetupDir "version.txt") -Value $Version -Encoding ASCII

$appSize = [math]::Round((Get-ChildItem $appPayload -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Write-Ok "Application assemblee ($appSize Mo)."

# ------------------------------------------------------------------ icone

Write-Step "3/7 - Icone Windows"
$iconTarget = Join-Path $PayloadDir "shalo.ico"
$logoPng = Join-Path $Root "public\brand\mark.png"
if (-not (Test-Path $logoPng)) { $logoPng = Join-Path $Root "public\brand\logo.png" }

if (Test-Path $logoPng) {
    try {
        Add-Type -AssemblyName System.Drawing
        $source = [System.Drawing.Image]::FromFile($logoPng)
        $size = 256
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.DrawImage($source, 0, 0, $size, $size)
        $graphics.Dispose()
        $source.Dispose()

        $pngStream = New-Object System.IO.MemoryStream
        $bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $pngStream.ToArray()
        $pngStream.Dispose()
        $bitmap.Dispose()

        $iconStream = New-Object System.IO.MemoryStream
        $writer = New-Object System.IO.BinaryWriter($iconStream)
        $writer.Write([UInt16]0)          # reserved
        $writer.Write([UInt16]1)          # type = icon
        $writer.Write([UInt16]1)          # nombre d'images
        $writer.Write([Byte]0)            # largeur (0 = 256)
        $writer.Write([Byte]0)            # hauteur (0 = 256)
        $writer.Write([Byte]0)            # couleurs de palette
        $writer.Write([Byte]0)            # reserved
        $writer.Write([UInt16]1)          # plans
        $writer.Write([UInt16]32)         # bits par pixel
        $writer.Write([UInt32]$pngBytes.Length)
        $writer.Write([UInt32]22)         # offset des données
        $writer.Write($pngBytes)
        $writer.Flush()
        [System.IO.File]::WriteAllBytes($iconTarget, $iconStream.ToArray())
        $writer.Dispose()
        $iconStream.Dispose()
        Write-Ok "Icone generee (256x256) depuis $([System.IO.Path]::GetFileName($logoPng))."
    } catch {
        Write-Host "    Icone non generee : $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Info "Aucun logo PNG : icone par defaut."
}

# ------------------------------------------------------------------ node embarque

Write-Step "4/7 - Moteur Node.js"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

if ($DownloadNode) {
    try {
        Write-Info "Recherche de la derniere version LTS..."
        $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -TimeoutSec 30
        $lts = $index | Where-Object { $_.lts -and $_.version -like "v24.*" } | Select-Object -First 1
        if (-not $lts) { $lts = $index | Where-Object { $_.lts } | Select-Object -First 1 }
        if (-not $lts) { throw "aucune version LTS trouvee" }

        $label = "node-$($lts.version)-win-x64"
        $archive = Join-Path $BuildDir "$label.zip"
        New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
        if (-not (Test-Path $archive)) {
            Write-Info "Telechargement de Node.js $($lts.version) (LTS)..."
            Invoke-WebRequest -Uri "https://nodejs.org/dist/$($lts.version)/$label.zip" -OutFile $archive -TimeoutSec 600
        } else {
            Write-Info "Archive deja telechargee."
        }

        $extract = Join-Path $BuildDir $label
        if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
        Expand-Archive -Path $archive -DestinationPath $BuildDir -Force

        Copy-Item (Join-Path $extract "node.exe") $RuntimeDir -Force
        foreach ($extra in @("LICENSE", "README.md")) {
            if (Test-Path (Join-Path $extract $extra)) {
                Copy-Item (Join-Path $extract $extra) (Join-Path $RuntimeDir $extra) -Force
            }
        }
        $nodeVersion = & (Join-Path $RuntimeDir "node.exe") -v
        Write-Ok "Node.js $nodeVersion embarque (aucun prerequis pour l'utilisateur final)."
    } catch {
        Fail "telechargement de Node.js impossible : $($_.Exception.Message)"
    }
} else {
    $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($systemNode) {
        Write-Host "    Node.js n'est pas embarque : l'installeur utilisera le Node.js du systeme." -ForegroundColor Yellow
        Write-Host "    Relancez avec -DownloadNode pour produire un installeur autonome." -ForegroundColor Yellow
    } else {
        Fail "Node.js n'est pas installe et -DownloadNode n'a pas ete demande."
    }
    Remove-Item $RuntimeDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------ distributions

Write-Step "5/7 - Dossier distribuable"
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
$packageRoot = Join-Path $DistDir ("SHALO-COM-SPACE-" + $Version)
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

Invoke-Robocopy -Source $PayloadDir -Destination (Join-Path $packageRoot "payload")
Copy-Item (Join-Path $SetupDir "Installer.cmd") $packageRoot -Force
Copy-Item (Join-Path $SetupDir "Install-SHALO.ps1") $packageRoot -Force
Copy-Item (Join-Path $SetupDir "Uninstall-SHALO.ps1") $packageRoot -Force
if (Test-Path (Join-Path $SetupDir "README.md")) {
    Copy-Item (Join-Path $SetupDir "README.md") (Join-Path $packageRoot "README-INSTALLATION.md") -Force
}
Set-Content -Path (Join-Path $packageRoot "version.txt") -Value $Version -Encoding ASCII
Write-Ok "Dossier pret : $packageRoot"

# ------------------------------------------------------------------ zip

Write-Step "6/7 - Archives"
$zipPath = Join-Path $DistDir ("SHALO-COM-SPACE-" + $Version + "-win-x64.zip")
if (-not $NoZip) {
    Compress-Archive -Path $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal -Force
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Ok "Archive ZIP : $([System.IO.Path]::GetFileName($zipPath)) ($zipSize Mo)"
} else {
    Write-Info "Archive ZIP non demandee."
}

# ------------------------------------------------------------------ auto-extractible

Write-Step "7/7 - Installeur auto-extractible (.exe)"

# Nom livre aux clients : toujours le meme fichier, quelle que soit la version
# (la version reste visible dans les proprietes de l'executable).
$deliveryExe = Join-Path $SetupDir "shalo-com-space-setup.exe"
$exePath = Join-Path $DistDir ("shalo-com-space-setup-" + $Version + ".exe")

# Le compilateur C# livre avec Windows (.NET Framework 4) suffit : aucun outil
# supplementaire n'est necessaire pour produire l'executable unique.
$csc = @(
    (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($NoExe) {
    Write-Info "Installeur .exe non demande."
} elseif (-not $csc) {
    Write-Host "    Compilateur C# (Windows / .NET Framework 4) introuvable : .exe non genere." -ForegroundColor Yellow
} else {
    $sfxDir = Join-Path $BuildDir "sfx"
    if (Test-Path $sfxDir) { Remove-Item $sfxDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $sfxDir | Out-Null

    # Contenu embarque : le meme dossier que dans l'archive ZIP. L'archive deja
    # produite est reutilisee telle quelle quand elle existe.
    $bundleZip = Join-Path $sfxDir "bundle.zip"
    if ((-not $NoZip) -and (Test-Path $zipPath)) {
        Copy-Item $zipPath $bundleZip -Force
    } else {
        Push-Location $packageRoot
        try {
            Compress-Archive -Path "*" -DestinationPath $bundleZip -CompressionLevel Optimal -Force
        } finally {
            Pop-Location
        }
    }

    $bootstrapper = @'
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Principal;
using System.Threading;

internal static class Program
{
    private const string Payload = "SHALO_PAYLOAD";

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (!IsAdministrator())
            {
                return RelaunchElevated(args);
            }

            Console.Title = "SHALO COM SPACE - installation";
            Console.WriteLine();
            Console.WriteLine("  ============================================================");
            Console.WriteLine("   SHALO COM SPACE - installation Windows");
            Console.WriteLine("   BATIANA TECH - plateforme de communication digitale");
            Console.WriteLine("  ============================================================");
            Console.WriteLine();
            Console.WriteLine("  Preparation de l'installation...");

            string work = Path.Combine(Path.GetTempPath(), "shalo-setup-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(work);

            string archive = Path.Combine(work, "installation.zip");
            ExtractResource(archive);

            Console.WriteLine("  Extraction de l'application (peut prendre une minute)...");
            ZipFile.ExtractToDirectory(archive, work);
            File.Delete(archive);

            string installer = FindInstaller(work);
            if (installer == null)
            {
                Fail("les fichiers d'installation sont introuvables dans l'archive.");
                return 2;
            }

            string mode = "/auto";
            foreach (string argument in args)
            {
                if (string.Equals(argument, "/silent", StringComparison.OrdinalIgnoreCase))
                {
                    mode = "/silent";
                }
            }

            Console.WriteLine();
            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cmd.exe");
            start.Arguments = "/c \"\"" + installer + "\" " + mode + "\"";
            start.WorkingDirectory = Path.GetDirectoryName(installer);
            start.UseShellExecute = false;

            int code;
            using (Process child = Process.Start(start))
            {
                child.WaitForExit();
                code = child.ExitCode;
            }

            DeleteDirectory(work);
            return code;
        }
        catch (Exception error)
        {
            Fail(error.Message);
            return 1;
        }
    }

    private static bool IsAdministrator()
    {
        using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
        {
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }
    }

    private static int RelaunchElevated(string[] args)
    {
        ProcessStartInfo info = new ProcessStartInfo();
        info.FileName = Assembly.GetExecutingAssembly().Location;
        info.Verb = "runas";
        info.UseShellExecute = true;

        string arguments = "";
        foreach (string argument in args)
        {
            arguments += (arguments.Length == 0 ? "" : " ") + argument;
        }
        info.Arguments = arguments;

        try
        {
            using (Process child = Process.Start(info))
            {
                if (child == null)
                {
                    return 1;
                }
                child.WaitForExit();
                return child.ExitCode;
            }
        }
        catch (Exception error)
        {
            Console.WriteLine();
            Console.WriteLine("  Autorisation administrateur refusee : " + error.Message);
            Console.WriteLine("  SHALO COM SPACE necessite les droits administrateur pour s'installer.");
            return 1;
        }
    }

    private static void ExtractResource(string target)
    {
        using (Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream(Payload))
        {
            if (source == null)
            {
                throw new InvalidOperationException("la ressource d'installation est absente de l'executable.");
            }
            using (FileStream file = File.Create(target))
            {
                byte[] buffer = new byte[81920];
                int read;
                while ((read = source.Read(buffer, 0, buffer.Length)) > 0)
                {
                    file.Write(buffer, 0, read);
                }
            }
        }
    }

    private static string FindInstaller(string root)
    {
        string direct = Path.Combine(root, "Installer.cmd");
        if (File.Exists(direct))
        {
            return direct;
        }
        string[] found = Directory.GetFiles(root, "Installer.cmd", SearchOption.AllDirectories);
        return found.Length > 0 ? found[0] : null;
    }

    private static void DeleteDirectory(string directory)
    {
        for (int attempt = 0; attempt < 5; attempt++)
        {
            try
            {
                Directory.Delete(directory, true);
                return;
            }
            catch (Exception)
            {
                Thread.Sleep(800);
            }
        }
    }

    private static void Fail(string message)
    {
        Console.WriteLine();
        Console.WriteLine("  Installation interrompue : " + message);
        Console.WriteLine();
    }
}
'@
    Set-Content -Path (Join-Path $sfxDir "Bootstrapper.cs") -Value $bootstrapper -Encoding ASCII

    $numericVersion = $Version -replace '[^0-9.].*$', ''
    $assemblyInfo = @(
        "using System.Reflection;",
        "[assembly: AssemblyTitle(`"SHALO COM SPACE - installation`")]",
        "[assembly: AssemblyDescription(`"Installation de la plateforme SHALO COM SPACE`")]",
        "[assembly: AssemblyProduct(`"SHALO COM SPACE`")]",
        "[assembly: AssemblyCompany(`"BATIANA TECH`")]",
        "[assembly: AssemblyCopyright(`"BATIANA TECH`")]",
        "[assembly: AssemblyVersion(`"$numericVersion.0`")]",
        "[assembly: AssemblyFileVersion(`"$numericVersion.0`")]",
        "[assembly: AssemblyInformationalVersion(`"$Version`")]"
    )
    Set-Content -Path (Join-Path $sfxDir "AssemblyInfo.cs") -Value $assemblyInfo -Encoding ASCII

    Write-Info "Compilation de l'installeur (peut prendre une minute)..."
    $cscArguments = @(
        "/nologo",
        "/target:exe",
        "/optimize+",
        "/platform:anycpu",
        "/out:$exePath",
        "/resource:$bundleZip,SHALO_PAYLOAD",
        "/r:System.IO.Compression.dll",
        "/r:System.IO.Compression.FileSystem.dll",
        (Join-Path $sfxDir "Bootstrapper.cs"),
        (Join-Path $sfxDir "AssemblyInfo.cs")
    )
    $iconPath = Join-Path $PayloadDir "shalo.ico"
    if (Test-Path $iconPath) { $cscArguments += "/win32icon:$iconPath" }

    $compilerOutput = & $csc @cscArguments 2>&1
    if ((Test-Path $exePath) -and (Get-Item $exePath).Length -gt 1MB) {
        $exeSize = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
        Copy-Item $exePath $deliveryExe -Force
        Write-Ok "Installeur a livrer : $deliveryExe ($exeSize Mo)"
    } else {
        Write-Host "    Compilation de l'executable echouee :" -ForegroundColor Yellow
        foreach ($line in $compilerOutput) { Write-Host "      $line" -ForegroundColor Yellow }
        Write-Host "    L'archive ZIP reste utilisable." -ForegroundColor Yellow
    }
}

# ------------------------------------------------------------------ inno (option)

if ($Inno) {
    Write-Step "Option - Inno Setup"
    $iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if (-not $iscc) {
        foreach ($candidate in @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe")) {
            if (Test-Path $candidate) { $iscc = Get-Item $candidate }
        }
    }
    if (-not $iscc) {
        Write-Host "    Inno Setup 6 introuvable : script .iss fourni mais non compile." -ForegroundColor Yellow
    } else {
        $issPath = Join-Path $SetupDir "inno\SHALO_COM_SPACE.iss"
        $process = Start-Process -FilePath $iscc.FullName -ArgumentList "/DAppVersion=$Version", "`"$issPath`"" -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -eq 0) {
            Write-Ok "Installeur Inno Setup compile dans setup\dist."
        } else {
            Write-Host "    Compilation Inno Setup echouee (code $($process.ExitCode))." -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Write-Host "   Paquet Windows pret" -ForegroundColor Green
Write-Host "   Dossier  : $DistDir" -ForegroundColor White
if (Test-Path $deliveryExe) {
    Write-Host "   A livrer : $deliveryExe" -ForegroundColor Yellow
}
Write-Host "  ============================================================" -ForegroundColor DarkBlue
Get-ChildItem $DistDir | Select-Object Name, @{n = "Taille"; e = { if ($_.PSIsContainer) { "<dossier>" } else { "{0:N1} Mo" -f ($_.Length / 1MB) } } } | Format-Table -AutoSize
