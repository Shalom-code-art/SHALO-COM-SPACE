; ============================================================================
;  SHALO COM SPACE - installeur Windows (Inno Setup 6)
;  BATIANA TECH
;
;  Ce script produit un executable unique, signable, avec assistant classique.
;  Tout le travail d'installation (copie, service, migrations, raccourcis,
;  base de donnees) reste assure par Install-SHALO.ps1 : l'installeur ne fait
;  que presenter l'assistant, extraire les fichiers et lancer ce script.
;
;  Compilation :
;     ISCC.exe /DAppVersion=1.0.0 SHALO_COM_SPACE.iss
;  ou, depuis la racine du projet :
;     powershell -File setup\Build-Installer.ps1 -Inno
;
;  Prerequis : le dossier setup\payload doit avoir ete construit
;  (setup\Build-Installer.ps1) avant la compilation.
; ============================================================================

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

#define AppName        "SHALO COM SPACE"
#define AppPublisher   "BATIANA TECH"
#define AppExeName     "Installer.cmd"
#define AppId          "{{8F3A61C2-4D7B-4E19-9C05-2B7E45A1D3F8}"

#if !FileExists(SourcePath + "..\payload\app\server.js")
  #error Le dossier setup\payload est absent ou incomplet. Lancez d'abord : powershell -File setup\Build-Installer.ps1
#endif

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://batiana.tech
AppSupportURL=https://batiana.tech
AppComments=Plateforme de communication digitale multi-tenant
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} - installation Windows
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}

DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableWelcomePage=no
DisableDirPage=no

; Le desinstalleur officiel est Desinstaller.cmd, cree par Install-SHALO.ps1 et
; enregistre lui-meme dans "Applications et fonctionnalites". On evite ainsi
; une deuxieme entree en doublon avec un chemin de desinstallation different.
Uninstallable=no

OutputDir=..\dist
OutputBaseFilename=SHALO-COM-SPACE-{#AppVersion}-setup-win-x64
SetupIconFile=..\payload\shalo.ico
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
Compression=lzma2/max
SolidCompression=yes
LZMAUseSeparateProcess=yes
CloseApplications=no
RestartApplications=no
DirExistsWarning=no
UsePreviousLanguage=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "lan"; Description: "Rendre SHALO COM SPACE accessible aux autres postes du reseau local (pare-feu Windows inclus)"; GroupDescription: "Reseau :"; Flags: unchecked

[Files]
; L'application et le moteur Node.js sont extraits dans un dossier temporaire :
; Install-SHALO.ps1 les deplace lui-meme vers {app} puis Inno Setup efface le
; temporaire. Le dossier d'installation ne contient ainsi aucun doublon.
Source: "..\payload\app\*"; DestDir: "{tmp}\shalo-setup\payload\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\payload\runtime\*"; DestDir: "{tmp}\shalo-setup\payload\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\payload\shalo.ico"; DestDir: "{tmp}\shalo-setup\payload"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\Install-SHALO.ps1"; DestDir: "{tmp}\shalo-setup"; Flags: ignoreversion
Source: "..\Uninstall-SHALO.ps1"; DestDir: "{tmp}\shalo-setup"; Flags: ignoreversion
Source: "..\Installer.cmd"; DestDir: "{tmp}\shalo-setup"; Flags: ignoreversion
Source: "..\version.txt"; DestDir: "{tmp}\shalo-setup"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\README.md"; DestDir: "{tmp}\shalo-setup"; DestName: "README-INSTALLATION.md"; Flags: ignoreversion skipifsourcedoesntexist

[Run]
Filename: "{sysnative}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{tmp}\shalo-setup\Install-SHALO.ps1"" -InstallDir ""{app}"" -Port {code:GetPort} -NoBrowser -Unattended"; \
  WorkingDir: "{tmp}\shalo-setup"; StatusMsg: "Installation de SHALO COM SPACE (fichiers, base de donnees, service)..."; \
  Flags: waituntilterminated; Tasks: not lan

Filename: "{sysnative}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{tmp}\shalo-setup\Install-SHALO.ps1"" -InstallDir ""{app}"" -Port {code:GetPort} -Lan -NoBrowser -Unattended"; \
  WorkingDir: "{tmp}\shalo-setup"; StatusMsg: "Installation de SHALO COM SPACE (fichiers, base de donnees, service)..."; \
  Flags: waituntilterminated; Tasks: lan

Filename: "http://localhost:{code:GetPort}/setup"; \
  Description: "Ouvrir SHALO COM SPACE pour creer le premier administrateur"; \
  Flags: postinstall shellexec runasoriginaluser nowait skipifsilent

[Code]
var
  PortPage: TInputQueryWizardPage;
  PortValue: String;

{ Lit un parametre de ligne de commande de la forme /NOM=valeur.
  Permet le deploiement silencieux : Setup.exe /VERYSILENT /PORT=9000 /TASKS=lan }
function CmdParam(const Name: String; var Value: String): Boolean;
var
  I: Integer;
  Prefix: String;
  Current: String;
begin
  Result := False;
  Prefix := '/' + Uppercase(Name) + '=';
  for I := 1 to ParamCount do
  begin
    Current := Uppercase(ParamStr(I));
    if Copy(Current, 1, Length(Prefix)) = Prefix then
    begin
      Current := ParamStr(I);
      Value := Copy(Current, Length(Prefix) + 1, Length(Current));
      Result := True;
      Exit;
    end;
  end;
end;

function GetPort(Param: String): String;
begin
  Result := PortValue;
end;

procedure InitializeWizard;
var
  Requested: String;
begin
  if CmdParam('PORT', Requested) then
    PortValue := Requested
  else
    PortValue := '8080';

  PortPage := CreateInputQueryPage(wpSelectDir,
    'Configuration du serveur',
    'Port HTTP de SHALO COM SPACE',
    'SHALO COM SPACE s''utilise depuis un navigateur, a l''adresse ' +
    'http://localhost:port. Choisissez le port d''ecoute sur ce poste. ' +
    'Conservez 8080 si aucun autre logiciel ne l''utilise deja.');
  PortPage.Add('Port HTTP (entre 1024 et 65535) :', False);
  PortPage.Values[0] := PortValue;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Parsed: Integer;
begin
  Result := True;
  if (PortPage <> nil) and (CurPageID = PortPage.ID) then
  begin
    Parsed := StrToIntDef(Trim(PortPage.Values[0]), 0);
    if (Parsed < 1024) or (Parsed > 65535) then
    begin
      MsgBox('Le port doit etre un nombre entier entre 1024 et 65535.', mbError, MB_OK);
      Result := False;
    end
    else
      PortValue := IntToStr(Parsed);
  end;
end;

{ Verifie, une fois les fichiers extraits, qu'un moteur Node.js est disponible :
  embarque dans l'installeur ou installe sur le poste. Le message est affiche
  avant l'installation plutot que de la laisser echouer a la fin. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Bundled: String;
begin
  Result := '';
  NeedsRestart := False;
  Bundled := ExpandConstant('{tmp}\shalo-setup\payload\runtime\node.exe');
  if FileExists(Bundled) then
    Exit;

  if FileExists(ExpandConstant('{sysnative}\node.exe')) or
     FileExists(ExpandConstant('{pf}\nodejs\node.exe')) or
     FileExists(ExpandConstant('{pf32}\nodejs\node.exe')) then
    Exit;

  Result :=
    'Node.js est introuvable sur ce poste : SHALO COM SPACE ne peut pas demarrer.' + #13#10 +
    'Utilisez l''installeur autonome (moteur Node.js inclus) ou installez ' +
    'Node.js 22.18 ou superieur depuis https://nodejs.org, puis relancez l''installation.';
end;
