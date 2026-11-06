# SHALO COM SPACE

Plateforme SaaS multi-entreprises de communication digitale et de marketing intelligent.
Développée pour **BATIANA TECH** — November 2026.

SHALO COM SPACE regroupe, dans une seule interface professionnelle, la production de contenus,
le calendrier éditorial, les campagnes, les réseaux sociaux, les contacts, le catalogue/boutique,
la médiathèque, l'analyse des performances et la gestion d'équipe — avec une console séparée
réservée à BATIANA TECH pour l'administration de la plateforme.

---

## Sommaire

1. [Principes du produit](#1-principes-du-produit)
2. [Pile technique et choix](#2-pile-technique-et-choix)
3. [Modules livrés](#3-modules-livrés)
4. [Prérequis](#4-prérequis)
5. [Installation](#5-installation)
6. [Premier démarrage](#6-premier-démarrage)
7. [Variables d'environnement](#7-variables-denvironnement)
8. [Commandes disponibles](#8-commandes-disponibles)
9. [Structure du projet](#9-structure-du-projet)
10. [Sécurité et isolation des données](#10-sécurité-et-isolation-des-données)
11. [API REST v1](#11-api-rest-v1)
12. [Tests](#12-tests)
13. [Déploiement](#13-déploiement)
14. [Intégrations restant à configurer](#14-intégrations-restant-à-configurer)
15. [Limites connues](#15-limites-connues)
16. [Documentation](#16-documentation)

---

## 1. Principes du produit

Trois règles ont guidé chaque écran de cette application :

- **Aucune donnée fictive.** Chaque chiffre affiché (tableau de bord, analytics, rapports)
  provient d'une requête sur la base. Une période sans activité affiche zéro, jamais une
  valeur d'illustration.
- **Aucune action simulée.** Une publication n'est jamais marquée « publiée » sans action
  réelle : soit une intégration officielle est configurée et l'envoi a abouti, soit
  l'utilisateur publie manuellement puis déclare la publication. Un bouton ne fait jamais
  semblant de fonctionner.
- **Aucune intégration inventée.** Les fournisseurs IA et les réseaux sociaux ne sont
  proposés que s'ils sont réellement configurés ; sinon l'interface l'indique explicitement
  avec la procédure à suivre.

---

## 2. Pile technique et choix

| Domaine | Choix | Justification |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Rendu serveur, Server Actions, routes API dans un seul déploiement. |
| Langage | TypeScript 5.9 (`strict`) | Typage de bout en bout : schémas, permissions, requêtes. |
| Styles | Tailwind CSS v4 | Design system maison (couleurs BATIANA, composants `ui.tsx`). |
| Base de données | SQLite via `node:sqlite` (`DatabaseSync`) | Relationnel, transactionnel, zéro service externe à installer ; migrations SQL versionnées. Portage PostgreSQL documenté. |
| Migrations | SQL numérotées (`db/migrations/*.sql`) | Appliquées automatiquement au démarrage, rejouables via script. |
| Validation | Zod | Une seule source de vérité pour les formulaires et Server Actions. |
| PDF | `pdf-lib` | Génération de rapports sans binaire externe. |
| CSV | Module interne (`src/lib/csv.ts`) | BOM UTF-8 pour Excel FR, échappement maîtrisé, aucune dépendance. |
| Authentification | Maison : `scrypt` + jetons de session hachés | Aucune dépendance d'authentification opaque ; contrôle total du schéma de sessions. |
| Chiffrement | AES-256-GCM (`node:crypto`) | Jetons sociaux et clés IA chiffrés au repos. |

Total des dépendances d'exécution : `next`, `react`, `react-dom`, `zod`, `pdf-lib`.
Aucune bibliothèque d'interface, de graphiques, d'authentification ou d'ORM n'a été ajoutée.

---

## 3. Modules livrés

| # | Module | Route principale | État |
|---|---|---|---|
| 01 | Tableau de bord | `/app` | Opérationnel — indicateurs, activité récente, raccourcis, notifications. |
| 02 | Centre IA | `/app/ai` | Opérationnel — 13 familles de demandes, 7 tons, 5 langues, historique, conversion en contenu. Nécessite une clé fournisseur. |
| 03 | Studio de contenus | `/app/content`, `/app/content/[id]` | Opérationnel — 10 types, brouillons/révisions, commentaires, médias liés, duplication, archivage, suppression contrôlée. |
| 04 | Calendrier éditorial | `/app/calendar` | Opérationnel — vues jour/semaine/mois, 7 statuts, programmation. |
| 05 | Réseaux sociaux | `/app/social` | Opérationnel en mode réel : connexion déclarée, publication manuelle déclarée. Publication automatique dès que les identifiants officiels sont fournis. |
| 06 | Campagnes | `/app/campaigns`, `/app/campaigns/[id]` | Opérationnel — fiche complète, budget, canaux, KPI, aide IA, résultats. |
| 07 | Contacts | `/app/contacts`, `/app/team-contacts` | Opérationnel — deux répertoires strictement séparés, historique d'interactions, étiquettes, consentement, import/export CSV, détection de doublons. |
| 08 | Catalogue & boutique | `/app/catalog`, `/boutique/[slug]` | Opérationnel — catégories, produits/services, prix, disponibilité, mise en avant, vitrine publique. Paiement en ligne hors périmètre v1. |
| 09 | Médiathèque | `/app/media` | Opérationnel — images, logos, vidéos, documents, audio ; dossiers, quotas, accès contrôlé. |
| 10 | Analytics & rapports | `/app/analytics` | Opérationnel — période comparée, séries réelles, export CSV et PDF. |
| 11 | Équipe & tâches | `/app/team` | Opérationnel — invitations, 7 rôles, matrice de permissions configurable, tâches, suspension, révocation de sessions. |
| 12 | Paramètres & administration | `/app/settings` | Opérationnel — identité, logo, IA, connexions, stockage, notifications, journal d'audit, clés API, gestion des données. |
| — | Console BATIANA TECH | `/admin` | Opérationnel — entreprises, plans, abonnements, quotas, statuts, journal global, suppression contrôlée. |

---

## 4. Prérequis

- **Node.js ≥ 22.18** (ou ≥ 23.6) — requis pour `node:sqlite` et l'exécution directe des
  tests en TypeScript. Cible de production : **Node 24 LTS**. Un correctif de compatibilité
  (`src/instrumentation.ts`) permet aussi l'exécution sur des runtimes expérimentaux
  (voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#compatibilité-nodejs)).
- **npm ≥ 10**.
- Aucun serveur de base de données à installer : SQLite est embarqué.
- Un disque accessible en écriture pour `./data` (base) — sauvegarde = copie de fichier.

---

## 5. Installation

### Windows : installeur en double-clic (utilisateur final)

Le dossier [`setup/`](setup/README.md) contient un installeur Windows complet : copie de
l'application, base SQLite, migrations, service de démarrage automatique, raccourcis et
entrée dans « Applications et fonctionnalités ».

1. Livrez au client le fichier **`setup/shalo-com-space-setup.exe`** (un seul fichier, aucun
   prérequis, Windows 10/11 64 bits) ; il s'installe par double-clic.
2. Acceptez l'autorisation administrateur, validez le dossier et le port.
3. À la fin, le navigateur s'ouvre sur `/setup` : créez le premier administrateur.

L'installation dépose l'icône **SHALO COM SPACE** sur le Bureau : le client double-clique
dessus pour ouvrir son application, sans rien connaître d'autre.

Sans l'installeur : décompressez l'archive ZIP puis lancez `Installer.cmd`.
Aucune ligne de commande n'est nécessaire. Pour un parc informatique :

```bat
Installer.cmd /silent
```

La désinstallation conserve les données par défaut (base, journaux, sauvegardes) et les
supprime uniquement sur demande explicite. Détail des options, du dépannage et de la
construction des paquets : [`setup/README.md`](setup/README.md).

### Windows (développement, PowerShell)

```powershell
cd "C:\chemin\vers\SHALO COM SPACE"
Copy-Item .env.example .env.local
# éditer .env.local et renseigner au minimum APP_SECRET
npm install
npm run dev
```

> Dans PowerShell, `&&` n'est pas un séparateur d'instruction : utiliser `;`.
> Si `npm` est bloqué par la politique d'exécution, appeler directement
> `& "C:\Program Files\nodejs\npm.cmd" run dev`.

### macOS / Linux

```bash
cd "/chemin/vers/shalo-com-space"
cp .env.example .env.local
# éditer .env.local (APP_SECRET obligatoire)
npm install
npm run dev
```

L'application est disponible sur <http://localhost:3000>.

### Générer un `APP_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cette clé chiffre les jetons et clés stockés en base. La changer rend illisibles
les secrets déjà enregistrés (ils doivent être ressaisis).

---

## 6. Premier démarrage

L'application n'insère **aucune donnée de démonstration**. Deux créations explicites sont
nécessaires :

1. **Administrateur plateforme (BATIANA TECH)** — ouvrir `/setup`.
   La page n'est utilisable que si aucun administrateur plateforme n'existe. Nom, email et
   mot de passe (10 caractères minimum). Une fois créé, `/setup` refuse toute nouvelle
   inscription : les administrateurs suivants se créent depuis la console.
2. **Première entreprise cliente** — ouvrir `/register`.
   Crée l'entreprise, son propriétaire (`owner`) et sa session. Le reste de l'équipe est
   invité depuis `/app/team` (lien d'invitation valable 7 jours).

Ensuite :

- console plateforme : `/admin` ;
- espace entreprise : `/app` ;
- vitrine publique : `/boutique/<slug>`.

---

## 7. Variables d'environnement

Voir [`.env.example`](.env.example). Seule `APP_SECRET` est obligatoire.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `APP_SECRET` | Oui | Clé maîtresse de chiffrement (AES-256-GCM). ≥ 16 caractères. |
| `DATABASE_PATH` | Non | Chemin du fichier SQLite (défaut `./data/shalo.db`). |
| `APP_URL` | Non | URL publique de l'instance (liens absolus, aperçus). En production : `https://app.exemple.com`. |
| `OPENAI_API_KEY` | Non | Clé de repli OpenAI (une clé d'entreprise est prioritaire). |
| `ANTHROPIC_API_KEY` | Non | Clé de repli Anthropic. |
| `GOOGLE_AI_API_KEY` | Non | Clé de repli Google Gemini. |
| `SHALORAH_API_KEY` | Non | Fournisseur SHALORAH (protocole OpenAI-compatible, intégration prévue). |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_PAGE_ACCESS_TOKEN` | Non | Publication Facebook Page. |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Non | Publication Instagram (avec l'app Meta ci-dessus). |
| `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Non | WhatsApp Business Cloud API. |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ORGANIZATION_ID` | Non | Page entreprise LinkedIn. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Non | Content Posting API. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Non | YouTube Data API v3. |

Une plateforme sociale n'est considérée « configurée » que si **toutes** ses variables sont
présentes ; sinon l'interface propose la procédure manuelle.

---

## 8. Commandes disponibles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement sur le port 3000. |
| `npm run build` | Build de production (sortie `standalone`). |
| `npm run start` | Démarre le serveur compilé. |
| `npm run typecheck` | Vérification TypeScript stricte (`tsc --noEmit`). |
| `npm run test` | Suite de tests automatisés (`node --test`). |
| `npm run db:migrate` | Applique les migrations en attente. |
| `npm run db:migrate -- --status` | Liste les migrations appliquées / en attente. |
| `npm run db:reset` | Vide la base et rejoue toutes les migrations (destructif, confirmation requise). |
| `npm run db:seed-demo` | Crée un espace de démonstration local (refusé en production). |
| `npm run docs:word` | Régénère les sept documents Word de `docs/` depuis les sources Markdown. |

Les migrations sont également appliquées automatiquement au démarrage de l'application.

---

## 9. Structure du projet

```
db/
  migrations/            Migrations SQL versionnées (0001_init.sql = schéma complet)
docs/                    Architecture, API, déploiement, guide utilisateur
public/                  Fichiers publics (logos)
scripts/migrate.mjs      CLI de migration (--status, --reset)
setup/                   Installeur Windows (Install/Uninstall/Build, script Inno Setup)
src/
  app/
    app/                 Espace entreprise (12 modules)
    admin/               Console BATIANA TECH
    api/v1/              API REST v1 (JSON, CSV, PDF)
    api/shop/            Vitrine publique (médias)
    boutique/[slug]/     Boutique publique
    login, register,
    setup, invitation,
    suspended, page.tsx  Pages d'accès et institutionnelles
  components/            Design system et composants clients
  lib/                   Noyau : db, auth, permissions, validation, format,
                         crypto, media, csv, pdf, reports, api, social, ai-*
  server/actions/        Server Actions (mutations + audit)
  proxy.ts               Filtrage d'accès en amont
tests/                   Tests unitaires et d'intégration du schéma
```

Chaque mutation passe par une Server Action située dans `src/server/actions/`, qui :
vérifie la session, vérifie la permission, valide les données (Zod), écrit en base avec
`company_id = <entreprise de l'utilisateur>`, puis journalise l'action.

---

## 10. Sécurité et isolation des données

| Mesure | Mise en œuvre |
|---|---|
| Mots de passe | `scrypt` (N=16384, r=8, p=1), sel de 16 octets, comparaison en temps constant. |
| Sessions | Jeton aléatoire de 32 octets, seul le SHA-256 est stocké ; cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, expiration 7 jours. |
| Limitation de connexion | 8 échecs par identifiant et par fenêtre de 15 minutes, journalisés dans `login_attempts`. |
| Révocation | Déconnexion, suspension d'un membre, changement de statut d'entreprise : toutes les sessions concernées sont révoquées. |
| Permissions | 33 permissions, 7 rôles entreprise + administrateur plateforme ; vérification **serveur** sur chaque page (`requireUser`) et chaque action. |
| Isolation multi-entreprises | `company_id` sur toutes les tables métier, filtré dans chaque requête ; vérification d'appartenance avant modification. |
| Validation | Schémas Zod sur toutes les entrées ; requêtes paramétrées SQL (aucune concaténation de valeurs). |
| Secrets | Jetons sociaux et clés IA chiffrés AES-256-GCM ; jamais renvoyés au navigateur, masqués à l'affichage. |
| Fichiers | Type MIME sur liste blanche, taille limitée à 10 Mo, quota par entreprise, service via route contrôlée (jamais de fichier client exposé statiquement). |
| Journal d'audit | Toute action sensible (connexion, création, modification, suppression, export, intervention plateforme) est enregistrée avec acteur, IP, entreprise et horodatage. |
| Console plateforme | Accès aux seules métadonnées (identité, plan, quotas, volumétrie, journal). Aucun accès autonome au contenu privé ; chaque consultation est journalisée. |
| En-têtes | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` ; `poweredByHeader` désactivé. |

---

## 11. API REST v1

Deux modes d'authentification :

- **Clé API** (`Authorization: Bearer shalo_…`) — créée dans `/app/settings`, hachée en base,
  révocable, permissions du propriétaire hors administration plateforme.
- **Session** — cookie de l'utilisateur connecté (utilisé par les exports depuis l'interface).

Endpoints : `/api/v1/me`, `/api/v1/contents`, `/api/v1/contents/{id}`, `/api/v1/contacts`,
`/api/v1/campaigns`, `/api/v1/products`, `/api/v1/analytics/summary`, plus les exports
CSV/PDF et la médiathèque. Détail complet : [`docs/API.md`](docs/API.md).

---

## 12. Tests

```bash
npm run test
```

35 tests couvrent : chiffrement et masquage des secrets, hachage `scrypt`, calcul des
permissions effectives, groupes de permissions, formatage métier, CSV (échappement, BOM),
et intégration du schéma (isolation `company_id`, index, contraintes, suppression en
cascade, survie du journal d'audit, absence de données fictives dans les migrations).

Résultats détaillés (types, build, tests, vérification d'exécution de chaque module) :
[`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md).

---

## 13. Déploiement

Guide complet : [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Résumé :

```bash
npm ci
npm run test
npm run build
APP_SECRET=... DATABASE_PATH=/var/lib/shalo/shalo.db npm run start
```

Le build produit un serveur autonome (`.next/standalone`). Points d'attention :

- placer `DATABASE_PATH` sur un volume persistant et sauvegardé ;
- définir `APP_SECRET` avant la première mise en service et ne plus le changer ;
- servir l'application derrière un reverse proxy TLS (HTTPS obligatoire) ;
- une seule instance applicative en écriture avec SQLite (voir limites).

---

## 14. Intégrations restant à configurer

Ces éléments sont **développés** mais nécessitent un accès externe que seul le client ou
l'éditeur peut fournir. L'application fonctionne sans eux et l'indique dans l'interface.

| Intégration | Ce qui manque | Comportement actuel |
|---|---|---|
| Génération IA | Une clé API d'un fournisseur (OpenAI, Anthropic, Google, SHALORAH) | Le Centre IA refuse la génération avec un message explicite ; aucun faux résultat. |
| Facebook / Instagram | App Meta validée, `PAGE_ACCESS_TOKEN` avec `pages_manage_posts` | Publication manuelle déclarée. |
| WhatsApp Business | Compte Cloud API, modèles de message approuvés | Envoi manuel puis déclaration. |
| LinkedIn | App Marketing API approuvée, `LINKEDIN_ORGANIZATION_ID` | Publication manuelle déclarée. |
| TikTok | Compte développeur validé, application auditée | Publication manuelle déclarée. |
| YouTube | Projet Google Cloud avec YouTube Data API v3 activée | Envoi manuel, URL et statistiques reportées. |
| E-mail transactionnel | Fournisseur SMTP/API à choisir | Les invitations sont transmises par lien copiable ; aucune promesse d'envoi automatique. |
| Paiement en ligne | Prestataire (mobile money / carte) | Hors périmètre v1 : la boutique présente le catalogue, sans encaissement. |

---

## 15. Limites connues

- **SQLite en mono-instance.** Adapté à une PME par entreprise ; plusieurs instances
  applicatives en écriture nécessitent PostgreSQL (le schéma est du SQL standard, la couche
  d'accès est isolée dans `src/lib/db.ts`).
- **Médias en base (BLOB).** Simple et sauvegardable, avec un plafond de 10 Mo par fichier ;
  au-delà de quelques milliers de fichiers, prévoir un stockage objet compatible S3.
- **Publication automatique non testée en production.** Le code d'envoi existe, mais sans
  identifiants réels il n'a pas pu être validé bout en bout avec les API des plateformes.
- **Pas de thème sombre ni de traduction multi-langues de l'interface.** L'architecture est
  prête (libellés centralisés dans `src/lib/format.ts` et `src/lib/permissions.ts`), seule la
  locale `fr-FR` est livrée.
- **Notifications internes uniquement** (centre de notifications de l'application) : pas
  d'envoi e-mail ou push tant qu'un fournisseur n'est pas choisi.
- **Recherche globale** limitée aux entités principales (contenus, campagnes, contacts,
  produits, médias, tâches), sans indexation plein texte.

---

## 16. Documentation

| Document | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architecture applicative, modèle de données, flux d'authentification, décisions techniques. |
| [`docs/API.md`](docs/API.md) | API REST v1 : authentification, endpoints, paramètres, codes d'erreur, exemples. |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Installation serveur, variables, sauvegarde/restauration, mise à jour, supervision. |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | Guide utilisateur module par module, rôles et responsabilités. |
| [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) | Résultats des tests et de la vérification d'exécution (build, pages, API, migrations). |
| [`db/migrations/0001_init.sql`](db/migrations/0001_init.sql) | Schéma complet de la base (tables, index, contraintes). |
| [`docs/README.md`](docs/README.md) | Index de la documentation (sources Markdown et versions Word). |

### Versions Word (.docx)

Les mêmes documents sont également livrés au format Word, dans `docs/` :

- `00_SHALO_COM_SPACE_Documentation_complete.docx` — compilation complète (sommaire + six parties) ;
- `01_Presentation_et_Installation.docx`, `02_Architecture_technique.docx`, `03_API_REST_v1.docx`,
  `04_Deploiement_et_Exploitation.docx`, `05_Guide_Utilisateur.docx`, `06_Resultats_de_Verification.docx` —
  un fichier par partie, avec page de garde, en-tête, pied de page paginé et tableaux mis en forme.

Ils sont régénérés depuis les sources Markdown par la commande `npm run docs:word`
(script `scripts/build-docs-docx.mjs`, dépendance de développement `docx`, aucun logiciel externe requis).

---

© BATIANA TECH — SHALO COM SPACE. Tous droits réservés.
