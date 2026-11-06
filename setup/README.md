# Installation de SHALO COM SPACE sous Windows

Ce dossier contient tout ce qui permet d'installer **SHALO COM SPACE** sur un
poste Windows sans connaissance technique : un installeur en double-clic, un
désinstalleur, et les scripts qui produisent ces paquets.

| Fichier | Rôle |
| --- | --- |
| **`shalo-com-space-setup.exe`** | **Le fichier à livrer aux clients : installation en double-clic** |
| `Installer.cmd` | Point d'entrée : assistant d'installation, désinstallation, état, ouverture |
| `Install-SHALO.ps1` | Installe l'application, la base, le service de démarrage et les raccourcis |
| `Uninstall-SHALO.ps1` | Désinstalle l'application (les données sont conservées par défaut) |
| `Build-Installer.ps1` | Construit le paquet : payload, ZIP, `.exe` auto-extractible, Inno Setup |
| `inno/SHALO_COM_SPACE.iss` | Script Inno Setup pour une alternative signable au `.exe` |
| `tools/migrate-standalone.mjs` | Applique les migrations SQL à l'installation |

`shalo-com-space-setup.exe` est produit par `Build-Installer.ps1` (aussi copié,
versionné, dans `dist/`). C'est lui qu'on grave sur une clé USB ou qu'on envoie
au client : un seul fichier, aucun prérequis, Windows 10/11 64 bits.

---

## 1. Ce que fait l'installation

1. Vérifie les droits administrateur et la présence de Node.js (ou d'un moteur
   embarqué dans le paquet).
2. Copie l'application dans `C:\Program Files\SHALO COM SPACE\app`.
3. Crée le dossier de données `C:\ProgramData\SHALO COM SPACE` (base SQLite,
   journaux, sauvegardes).
4. Génère une configuration locale et un secret applicatif.
5. Applique les migrations SQL.
6. Enregistre le démarrage automatique (tâche planifiée au boot, compte
   `SYSTEM`) et démarre le serveur.
7. Crée le raccourci **SHALO COM SPACE** sur le Bureau (et dans le menu
   Démarrer) : double-clic = l'application s'ouvre dans le navigateur, en
   démarrant le serveur au besoin, sans fenêtre noire.
8. Enregistre l'application dans « Applications et fonctionnalités ».
9. Vérifie que la page de connexion répond, puis ouvre le navigateur sur
   `http://localhost:8080/setup`.

L'installation est **réversible** et **rejouable** : relancée sur une
installation existante, elle met à jour les fichiers sans toucher aux données ni
au secret applicatif.

---

## 2. Installation en trois clics (paquet `.exe`)

1. Sur le poste du client, lancez **`shalo-com-space-setup.exe`** (clé USB,
   partage réseau, pièce jointe).
2. Double-cliquez : Windows demande l'autorisation administrateur, acceptez.
3. L'assistant propose le dossier et le port : validez.
4. À la fin, le navigateur s'ouvre sur la page de configuration : créez le
   premier compte administrateur de la plateforme.

Ensuite, le client n'a plus qu'à double-cliquer sur l'icône **SHALO COM SPACE**
du Bureau pour ouvrir son application — c'est le seul geste à connaître.

Aucune ligne de commande, aucun prérequis : le paquet produit avec
`-DownloadNode` embarque lui-même le moteur d'exécution (Node.js LTS). Le
fichier fonctionne donc sur n'importe quel Windows 10/11 64 bits, même sans
Node.js, sans base de données et sans droits particuliers sur le poste.

---

## 3. Installation depuis l'archive ZIP

1. Extrayez `SHALO-COM-SPACE-<version>-win-x64.zip` (par exemple sur le Bureau).
2. Ouvrez le dossier extrait et double-cliquez sur `Installer.cmd`.
3. Choisissez **[1] Installer ou mettre à jour SHALO COM SPACE**.
4. Répondez aux deux questions (port, accès réseau) ou validez les valeurs
   proposées.

Le menu de `Installer.cmd` permet aussi de vérifier l'état, d'ouvrir
l'application et de la désinstaller au même endroit.

---

## 4. Installation silencieuse (parc informatique)

```bat
Installer.cmd /silent
```

ou directement, avec un contrôle total :

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-SHALO.ps1 -Unattended -Port 8080 -Lan
```

| Option | Effet |
| --- | --- |
| `-InstallDir <chemin>` | Dossier d'installation (défaut : `C:\Program Files\SHALO COM SPACE`) |
| `-DataDir <chemin>` | Dossier des données (défaut : `C:\ProgramData\SHALO COM SPACE`) |
| `-Port <nombre>` | Port HTTP local (défaut : `8080`) |
| `-Lan` | Rend l'application accessible aux autres postes (écoute `0.0.0.0` + pare-feu) |
| `-NoService` | Pas de démarrage automatique : lancement manuel |
| `-NoShortcuts` | Aucun raccourci créé |
| `-NoFirewall` | Aucune règle de pare-feu ajoutée |
| `-NoBrowser` | N'ouvre pas le navigateur à la fin |
| `-Portable` | Aucune modification du système (ni service, ni registre, ni raccourcis) |
| `-Unattended` | Aucune question posée |
| `-KeepExistingConfig` | Réinstallation : conserve port et exposition réseau actuels |

Pour un paquet Inno Setup, l'assistant accepte aussi les paramètres standards :

```bat
shalo-com-space-setup.exe /VERYSILENT /PORT=9000 /TASKS=lan
```

---

## 5. Désinstallation

- Menu Démarrer > **SHALO COM SPACE** > *Désinstaller*, ou
- « Applications et fonctionnalités » > **SHALO COM SPACE** > *Désinstaller*, ou
- `Installer.cmd` > **[2] Désinstaller SHALO COM SPACE**.

Par défaut, **les données sont conservées** (base, journaux, sauvegardes) : elles
permettent une réinstallation sans perte. Pour tout supprimer :

```powershell
powershell -ExecutionPolicy Bypass -File .\Uninstall-SHALO.ps1 -RemoveData -Unattended
```

---

## 6. Après l'installation

| Élément | Valeur par défaut |
| --- | --- |
| Adresse | `http://localhost:8080` |
| Configuration | `C:\Program Files\SHALO COM SPACE\config.cmd` |
| Base de données | `C:\ProgramData\SHALO COM SPACE\data\shalo.db` |
| Journaux | `C:\ProgramData\SHALO COM SPACE\logs` |
| État de l'installation | `C:\Program Files\SHALO COM SPACE\install.json` |
| Démarrage automatique | Tâche planifiée « SHALO COM SPACE » |
| Raccourci | Bureau : **SHALO COM SPACE** (lance `open-app.vbs`) |

La page `/setup` crée le premier administrateur, l'entreprise et son espace de
travail. C'est la seule étape manuelle : ensuite, tout se passe dans
l'application.

**`config.cmd` contient `APP_SECRET`** : il chiffre les clés d'intégration
enregistrées dans l'application. Ne le supprimez pas et ne le remplacez pas lors
d'une mise à jour — sans lui, les clés stockées deviennent illisibles.

---

## 7. Construire les paquets (maintenance)

Depuis la racine du projet :

```powershell
# Paquet standard (Node.js doit être présent sur le poste cible)
powershell -File setup\Build-Installer.ps1

# Paquet autonome : moteur Node.js LTS embarqué, rien à installer
powershell -File setup\Build-Installer.ps1 -DownloadNode

# Réutiliser le build existant et compiler aussi l'installeur Inno Setup
powershell -File setup\Build-Installer.ps1 -SkipBuild -Inno
```

Résultat dans `setup\dist` **et copie prête à livrer dans `setup\`** :

- **`setup\shalo-com-space-setup.exe`** : le fichier à envoyer au client (même
  nom à chaque version ; la version est dans ses propriétés Windows) ;
- `dist\shalo-com-space-setup-<version>.exe` : le même installeur, versionné
  pour l'archivage ; il extrait son contenu puis lance l'assistant (compilé avec
  le compilateur C# fourni par Windows, aucun outil à installer) ;
- `SHALO-COM-SPACE-<version>\` : dossier à copier sur clé USB ;
- `SHALO-COM-SPACE-<version>-win-x64.zip` : archive distribuable ;
- `SHALO-COM-SPACE-<version>-setup-win-x64.exe` : installeur Inno Setup
  (assistant graphique, plus léger), produit uniquement si `-Inno` est utilisé
  et qu'Inno Setup 6 est installé.

Pour signer l'exécutable (recommandé en diffusion large) :

```bat
signtool sign /fd SHA256 /a /tr http://timestamp.digicert.com /td SHA256 shalo-com-space-setup.exe
```

---

## 8. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| « Node.js est introuvable » | Paquet non autonome sur un poste sans Node.js | Utilisez le paquet `-DownloadNode`, ou installez Node.js 22.18+ |
| La page ne s'ouvre pas | Le serveur démarre encore | Patientez 10 s, puis rechargez `http://localhost:8080/login` |
| « Le port est déjà utilisé » | Un autre logiciel écoute sur le port | Relancez `Installer.cmd` et choisissez un autre port |
| Rien ne démarre au reboot | Tâche planifiée désactivée | `Get-ScheduledTask -TaskName "SHALO COM SPACE"` puis `Start-ScheduledTask` |
| Accès impossible depuis un autre poste | Pas d'accès réseau | Réinstallez avec `-Lan` (règle de pare-feu incluse) |
| Le serveur ne répond plus | Processus arrêté | Menu Démarrer > *Démarrer le service*, ou `Start-ScheduledTask -TaskName "SHALO COM SPACE"` |

Journaux utiles :

- `C:\ProgramData\SHALO COM SPACE\logs\server.log` : sortie du serveur ;
- `C:\ProgramData\SHALO COM SPACE\logs\service.log` : démarrages et arrêts.

Pour un environnement de test sans toucher au système :

```powershell
powershell -File .\Install-SHALO.ps1 -Portable -InstallDir D:\Tests\SHALO -Port 8099 -NoBrowser -Unattended
```

---

## 9. Sécurité

- Le serveur écoute par défaut sur `127.0.0.1` : il n'est **pas** exposé au
  réseau ni à Internet.
- `-Lan` ouvre uniquement le profil réseau **privé** du pare-feu Windows, sur le
  port choisi.
- Aucun secret n'est écrit en dehors du poste : la base et la configuration
  restent locales, sauf si vous les sauvegardez ailleurs.
- Pour une exposition sur Internet, placez un reverse proxy HTTPS devant
  l'application : voir `docs/DEPLOYMENT.md`.
