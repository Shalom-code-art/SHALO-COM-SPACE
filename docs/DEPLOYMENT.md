# Déploiement — SHALO COM SPACE

Guide d'installation sur un serveur Linux (Ubuntu/Debian) avec Node.js, systemd et Nginx.
La même procédure s'applique à un serveur Windows ou à un conteneur : seuls les chemins et
le gestionnaire de service changent.

---

## 1. Ce que produit le build

`next.config.ts` déclare `output: "standalone"` : `npm run build` génère un serveur
autonome dans `.next/standalone`, avec uniquement les dépendances réellement utilisées.

Structure à déployer :

```
/opt/shalo/
  server.js              ← .next/standalone/server.js
  node_modules/          ← copié automatiquement dans standalone
  .next/static/          ← à copier depuis le projet
  public/                ← à copier depuis le projet
  package.json
```

> `.next/static` et `public` ne sont **pas** inclus dans `standalone` par Next.js : ils
> doivent être copiés manuellement (voir §4).

---

## 2. Prérequis serveur

| Élément | Minimum | Recommandé |
|---|---|---|
| Node.js | 22.18 | 24 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 Mo | 1 Go |
| Disque | 2 Go | 20 Go (médias + sauvegardes) |
| Système | Linux x64, Windows Server | Ubuntu 24.04 LTS |
| Réseau | HTTPS obligatoire | Reverse proxy Nginx ou Caddy |

### Compatibilité Node.js

Les versions certifiées sont Node.js **22.18+** et **24 LTS**. Les versions
**expérimentales** (par exemple `27.0.0-alpha`) exposent `request.headers` sous forme
d'objet sans prototype ; Next.js appelle `headers.hasOwnProperty(...)` en interne et
échoue alors sur toutes les routes (HTTP 500).

`src/instrumentation.ts` contient un correctif de compatibilité, chargé au démarrage du
serveur : il rétablit le prototype standard de l'objet d'en-têtes, de façon idempotente, et
sans effet sur les versions supportées (où l'objet possède déjà son prototype). Ce
correctif permet d'exploiter l'application sur ces runtimes, mais **la cible de production
reste Node 24 LTS**.

---

## 3. Installation initiale

```bash
# 1. Utilisateur système non privilégié
sudo useradd --system --create-home --home-dir /opt/shalo --shell /usr/sbin/nologin shalo
sudo mkdir -p /opt/shalo /var/lib/shalo /var/backups/shalo
sudo chown -R shalo:shalo /opt/shalo /var/lib/shalo /var/backups/shalo

# 2. Code
sudo -u shalo git clone <depot> /opt/shalo/app
cd /opt/shalo/app
sudo -u shalo npm ci

# 3. Configuration
sudo -u shalo cp .env.example .env.production
sudo -u shalo nano .env.production
```

Variables à définir impérativement :

```env
APP_SECRET=<32+ caracteres aleatoires>
DATABASE_PATH=/var/lib/shalo/shalo.db
APP_URL=https://app.exemple.com
NODE_ENV=production
```

Générer la clé :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **`APP_SECRET` est définitif.** Le changer rend illisibles les jetons sociaux et clés IA
> déjà enregistrés. Conservez une copie hors ligne (gestionnaire de secrets).

---

## 4. Build et mise en service

```bash
cd /opt/shalo/app
sudo -u shalo npm run test        # 35 tests doivent passer
sudo -u shalo npm run build

# Assemblage du paquet autonome
sudo -u shalo rm -rf /opt/shalo/runtime
sudo -u shalo cp -r .next/standalone /opt/shalo/runtime
sudo -u shalo cp -r .next/static /opt/shalo/runtime/.next/static
sudo -u shalo cp -r public /opt/shalo/runtime/public
```

### Service systemd

`/etc/systemd/system/shalo.service` :

```ini
[Unit]
Description=SHALO COM SPACE (BATIANA TECH)
After=network.target

[Service]
Type=simple
User=shalo
Group=shalo
WorkingDirectory=/opt/shalo/runtime
EnvironmentFile=/opt/shalo/app/.env.production
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
# Durcissement
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/shalo

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now shalo
sudo systemctl status shalo
sudo journalctl -u shalo -f
```

`HOSTNAME=127.0.0.1` garde l'application derrière le proxy ; retirez-le si elle doit être
joignable directement.

---

## 5. Reverse proxy TLS (Nginx)

```nginx
server {
    listen 80;
    server_name app.exemple.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.exemple.com;

    ssl_certificate     /etc/letsencrypt/live/app.exemple.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.exemple.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Le plafond d'upload de l'application est de 10 Mo par fichier.
    client_max_body_size 12m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo certbot --nginx -d app.exemple.com
sudo nginx -t && sudo systemctl reload nginx
```

Le cookie de session est émis avec `Secure` en production : **l'application doit être
servie en HTTPS**, sinon la connexion échoue.

---

## 6. Première mise en service

1. Ouvrir `https://app.exemple.com/setup` → créer l'administrateur BATIANA TECH.
   La page se ferme définitivement une fois cet administrateur créé.
2. Créer la première entreprise via `https://app.exemple.com/register`.
3. Depuis `/admin`, vérifier le plan et le quota de stockage attribués.
4. Depuis `/app/settings`, renseigner l'identité de l'entreprise, le logo et, si besoin,
   la clé du fournisseur IA.
5. Depuis `/app/team`, inviter les membres (lien valable 7 jours).

---

## 7. Sauvegarde et restauration

### Sauvegarde à chaud (recommandée)

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 /var/lib/shalo/shalo.db ".backup '/var/backups/shalo/shalo-$STAMP.db'"
gzip "/var/backups/shalo/shalo-$STAMP.db"
# conservation 30 jours
find /var/backups/shalo -name 'shalo-*.db.gz' -mtime +30 -delete
```

`/etc/cron.d/shalo-backup` :

```cron
15 2 * * * shalo /usr/local/bin/shalo-backup.sh >> /var/log/shalo-backup.log 2>&1
```

La commande `.backup` de SQLite produit une copie cohérente même pendant les écritures ;
ne copiez jamais le fichier `.db` seul sans arrêter le service.

### Restauration

```bash
sudo systemctl stop shalo
sudo cp /var/lib/shalo/shalo.db /var/lib/shalo/shalo.db.before-restore
sudo gunzip -c /var/backups/shalo/shalo-20261101-021500.db.gz > /var/lib/shalo/shalo.db
sudo chown shalo:shalo /var/lib/shalo/shalo.db
sudo systemctl start shalo
```

### Sauvegarde applicative

En complément, `/api/v1/export/data` (permission `settings.manage`, ou depuis
`/app/settings` → Données) produit un export JSON complet de l'entreprise, utile pour une
reprise sélective ou un audit externe.

---

## 8. Mise à jour

```bash
cd /opt/shalo/app
sudo -u shalo git pull
sudo -u shalo npm ci
sudo -u shalo npm run test
sudo -u shalo npm run build
sudo -u shalo node scripts/migrate.mjs --status     # vérifier les migrations en attente
sudo -u shalo node scripts/migrate.mjs              # appliquer (transactionnel)

sudo -u shalo rm -rf /opt/shalo/runtime
sudo -u shalo cp -r .next/standalone /opt/shalo/runtime
sudo -u shalo cp -r .next/static /opt/shalo/runtime/.next/static
sudo -u shalo cp -r public /opt/shalo/runtime/public
sudo systemctl restart shalo
```

Faire une sauvegarde **avant** `migrate`. Les migrations sont également appliquées
automatiquement au démarrage, mais les exécuter explicitement permet de voir les erreurs
au calme.

---

## 9. Supervision

| Contrôle | Commande / point d'entrée |
|---|---|
| Service | `systemctl status shalo`, `journalctl -u shalo --since "1 hour ago"` |
| Disponibilité | `curl -fsS https://app.exemple.com/login > /dev/null && echo OK` |
| Base | `node scripts/migrate.mjs --status` |
| Taille base | `du -h /var/lib/shalo/shalo.db` |
| Quotas entreprises | console `/admin` (stockage consommé par entreprise) |
| Journal d'audit | `/admin/audit` (plateforme) et `/app/settings` → Journal (entreprise) |

Alertes utiles : échec du service, sauvegarde manquante, base > 80 % du disque, entreprise
suspendue depuis plus de 90 jours.

---

## 10. Sécurité opérationnelle

- Un seul processus applicatif en écriture (SQLite). Pour un déploiement multi-instances,
  migrer vers PostgreSQL (voir `docs/ARCHITECTURE.md` §15).
- Restreindre l'accès SSH, désactiver la connexion root, activer le pare-feu
  (`ufw allow 80,443/tcp`).
- `APP_SECRET` uniquement dans `.env.production` (chmod 600, propriétaire `shalo`), jamais
  dans le dépôt ni dans l'image.
- Sauvegardes chiffrées si elles quittent le serveur, et test de restauration au moins une
  fois par trimestre.
- Mettre à jour Node.js et les dépendances (`npm audit`, `npm outdated`) trimestriellement.
- Le port 3000 ne doit pas être exposé à Internet.

---

## 11. Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| `APP_SECRET manquant` / longueur | Variable absente ou < 16 caractères | Renseigner `.env.production`, redémarrer. |
| Connexion impossible, cookie non posé | Accès en HTTP en production | Servir en HTTPS (le cookie est `Secure`). |
| `SQLITE_BUSY` | Deux instances ou sauvegarde par copie de fichier | Un seul écrivain, utiliser `.backup`. |
| Page blanche après mise à jour | `.next/static` non recopié | Recopier le dossier dans `runtime/.next/static`. |
| Inscriptions `/setup` refusées | Un administrateur plateforme existe déjà | Se connecter, ajouter les comptes depuis `/admin`. |
| Erreur 403 sur l'API | Clé révoquée ou permission absente | Recréer la clé dans `/app/settings`. |
| HTTP 500 sur toutes les routes | Runtime Node expérimental (en-têtes sans prototype) ou `APP_SECRET` invalide | Utiliser Node 22.18+/24 LTS ; vérifier que `src/instrumentation.ts` est bien compilé (présent dans le build). |
| Upload refusé | Type non autorisé ou quota atteint | Vérifier `/app/settings` → Stockage. |

Logs applicatifs : `journalctl -u shalo -n 200 --no-pager`.
