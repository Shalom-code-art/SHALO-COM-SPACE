# Architecture — SHALO COM SPACE

Document de référence technique : organisation du code, modèle de données, flux
d'exécution, décisions structurantes et chemins d'évolution.

---

## 1. Vue d'ensemble

SHALO COM SPACE est une application web **monolithe modulaire** rendue côté serveur.

```
Navigateur
   │  HTML (RSC) + Server Actions + Fetch API v1
   ▼
Next.js (Node) ── proxy.ts (filtrage d'accès)
   │
   ├── src/app/app/**          Espace entreprise (12 modules)
   ├── src/app/admin/**        Console BATIANA TECH
   ├── src/app/api/v1/**       API REST (JSON / CSV / PDF)
   ├── src/app/boutique/**     Vitrine publique
   │
   ├── src/server/actions/**   Mutations (Server Actions : auth + permission + Zod + audit)
   ├── src/lib/**             Noyau métier réutilisable et testable
   │
   ▼
node:sqlite (DatabaseSync)  →  ./data/shalo.db  (+ WAL)
```

Le choix du monolithe est assumé : un seul processus à déployer, un seul jeu de
vérifications d'accès, aucune communication réseau interne, aucun surcoût
d'infrastructure. Les modules sont séparés par dossiers et par tables, pas par services.

---

## 2. Décisions structurantes

| Décision | Alternative écartée | Raison |
|---|---|---|
| **SQLite via `node:sqlite`** | PostgreSQL, MySQL, ORM | Zéro service externe, transactionnel, fichier unique sauvegardable ; volume visé (une PME par entreprise) largement couvert. La couche d'accès est confinée dans `src/lib/db.ts` pour un portage ultérieur. |
| **Migrations SQL versionnées** | `drizzle-kit`, Prisma Migrate | Le schéma est lisible et auditable sans outil propriétaire ; aucune dépendance de build. |
| **Authentification maison** | NextAuth, Auth.js | Le schéma de sessions, la révocation et la journalisation sont des exigences produit : les maîtriser évite les contournements. |
| **Server Actions pour toutes les mutations** | Routes API appelées en fetch | Une seule voie d'écriture ⇒ un seul endroit où vérifier session, permission, validation et audit. |
| **`company_id` explicite dans chaque requête** | Row Level Security | SQLite ne propose pas de RLS ; la contrainte est appliquée par convention stricte, vérifiée par les tests et la revue de code. |
| **Médias en base (BLOB)** | Stockage objet S3 | Aucun service externe requis, sauvegarde atomique avec les données. Plafond 10 Mo/fichier et quota par entreprise. |
| **Design system interne** | Bibliothèque de composants tierce | Sept composants maison suffisent ; contrôle total du rendu et du poids. |
| **Graphiques en CSS/SVG** | Chart.js, Recharts | Les séries sont simples (barres, aires) ; éviter 100–200 Ko de JavaScript inutile. |
| **Fournisseurs IA derrière une interface** | SDK officiel par fournisseur | Un seul adaptateur (`callProvider`) couvre trois protocoles ; ajouter un fournisseur = une entrée de configuration. |

---

## 3. Organisation du code

| Dossier | Responsabilité | Règle |
|---|---|---|
| `src/app/app/**` | Pages de l'espace entreprise | Composants serveur : lecture + rendu. Aucune écriture directe en base. |
| `src/app/admin/**` | Console plateforme | Uniquement métadonnées et actions de plateforme. |
| `src/app/api/**` | Endpoints REST, exports, médias | Authentification par `authenticateApi` ou `requireApiUser`. |
| `src/server/actions/**` | Mutations | `requireUser(permission)` → Zod → SQL paramétré → `logAudit`. |
| `src/lib/db.ts` | Accès base, migrations, helpers transactionnels | Seul endroit qui ouvre la base. |
| `src/lib/auth.ts` | Sessions, connexion, inscription, invitations | Ne contient aucune règle métier de module. |
| `src/lib/permissions.ts` | Rôles, permissions, matrice par défaut | Source de vérité unique des droits. |
| `src/lib/validation.ts` | Schémas Zod | Source de vérité unique des formats d'entrée. |
| `src/lib/format.ts` | Référentiels métier et formatage FR | Libellés, statuts, tons, types, montants, dates. |
| `src/lib/api.ts` | Authentification et pagination API | Adapte les erreurs en JSON normalisé. |
| `src/lib/{ai-providers,ai-prompts,social,settings,media,csv,pdf,reports,crypto,audit}.ts` | Capacités transverses | Modules purs, testables sans HTTP. |
| `src/components/**` | Design system et coquille applicative | Seuls quelques composants sont clients. |

Règle de dépendance : `app` → `server/actions` → `lib`. L'inverse n'existe pas ;
`lib` n'importe jamais une page ni une action.

---

## 4. Cycle d'exécution

### 4.1 Lecture d'une page

1. `src/proxy.ts` vérifie la présence du cookie de session sur `/app` et `/admin`
   (filtrage rapide ; la vérification réelle a lieu à l'étape suivante).
2. `src/app/app/layout.tsx` appelle `requireUser()` : session valide, compte actif,
   entreprise active, permissions chargées.
3. La page exécute ses requêtes SQL en filtrant systématiquement sur `company_id`.
4. Le rendu est envoyé en HTML (React Server Components) ; seuls les composants
   interactifs embarquent du JavaScript.

### 4.2 Mutation (Server Action)

```
requireUser("permission.requise")
        │  échec → redirect (401/403 visibles, pas de fuite d'information)
        ▼
schéma Zod (validation.ts)          → échec : message d'erreur ciblé
        ▼
requête SQL paramétrée + company_id → échec : message neutre
        ▼
notifications éventuelles
        ▼
logAudit({ acteur, action, entité, détails, IP })
        ▼
revalidatePath(...) + redirect("?saved=1")
```

Les erreurs sont transmises via l'URL (`?error=…`, `?saved=…`) plutôt que par un état
client : le rafraîchissement conserve le résultat et rien ne dépend du JavaScript.

### 4.3 Appel API v1

`authenticateApi(permission)` renvoie une identité unifiée (session **ou** clé API) :

```ts
type Identity = {
  companyId: string;
  actor: { id: string; name: string; role: string };
  permissions: string[];
  via: "session" | "api_key";
  keyId?: string;
};
```

Cette identité unique est la raison pour laquelle les mêmes fonctions de lecture
servent l'interface et l'API, sans duplication de règles.

---

## 5. Modèle de données

Base relationnelle, clés primaires textuelles (identifiants opaques), horodatages ISO 8601
UTC (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`), montants en centimes (`*_cents`).

### 5.1 Tables

| Domaine | Tables | Notes |
|---|---|---|
| Tenants | `companies` | Identité légale, identité visuelle, `shop_*`, `plan`, `subscription_*`, `storage_quota_mb`, `status`. |
| Comptes | `users`, `sessions`, `login_attempts`, `invitations`, `role_permissions` | `users.company_id` **NULL** + rôle `platform_admin` = administrateur BATIANA TECH. |
| Contenus | `contents`, `content_revisions`, `content_comments`, `content_media` | Révisions immuables ; liaison N–N aux médias. |
| Médias | `media` | BLOB + `external_url` ; `size_bytes` pour le quota. |
| Diffusion | `campaigns`, `social_accounts`, `publications` | Jetons sociaux chiffrés (`token_ciphertext`). |
| Contacts | `contacts`, `contact_interactions` | `kind = client \| employee` : deux répertoires cloisonnés par permission. |
| Catalogue | `product_categories`, `products` | `is_public` + `featured` pilotent la vitrine. |
| Organisation | `tasks` | Rattachables à un contenu ou une campagne. |
| Mesure | `analytics_snapshots`, `publication_metrics` | Relevés saisis ou collectés ; `source` explicite. |
| IA | `ai_generations` | Prompt, sortie, fournisseur, modèle, lien éventuel vers un contenu. |
| Système | `notifications`, `audit_logs`, `company_settings`, `api_keys`, `migrations` | `audit_logs.company_id` en `ON DELETE SET NULL` : le journal survit à la suppression d'une entreprise. |

### 5.2 Règles de conception

- **Toute table métier porte `company_id`** (vérifié par `tests/schema.test.mjs`).
- **Suppression en cascade** depuis `companies` : supprimer une entreprise efface ses
  données, sauf le journal d'audit et les comptes plateforme.
- **Aucune donnée insérée par les migrations** : le test `aucune donnee fictive` échoue
  si un `INSERT INTO` apparaît dans `db/migrations`.
- **Index ciblés** sur les colonnes de filtre réel (`company_id` + statut, date, type),
  pas d'index « au cas où ».

---

## 6. Isolation multi-entreprises

Trois couches, volontairement redondantes :

1. **Requête** — chaque `SELECT`/`UPDATE`/`DELETE` métier contient `company_id = ?`.
   Aucune requête « globale » en dehors de la console plateforme.
2. **Vérification d'appartenance** — avant modification, la ligne cible est relue avec
   `WHERE id = ? AND company_id = ?` ; une ligne d'une autre entreprise est indistinguable
   d'une ligne inexistante.
3. **Contrôle de test** — le test de schéma impose `company_id` sur les 22 tables métier et
   vérifie la cascade.

La console plateforme ne lit jamais le contenu privé : elle n'affiche que des métadonnées
(identité, plan, quotas, volumétrie, journal). Une consultation d'entreprise est journalisée.

---

## 7. Authentification et sessions

```
Connexion
  ├─ normalisation email + recherche utilisateur
  ├─ verrou ? (8 échecs / 15 min pour cet identifiant)        → refus explicite
  ├─ verifyPassword (scrypt + comparaison temps constant)      → journal login_attempts
  ├─ statut compte (active) et statut entreprise (active)      → refus / page /suspended
  ├─ création session : jeton 32 octets, seul SHA-256 stocké   → cookie httpOnly 7 jours
  └─ redirection selon le rôle (platform_admin → /admin)
```

- Cookie `shalo_session` : `httpOnly`, `sameSite=lax`, `secure` en production, `path=/`.
- Révocation immédiate à la déconnexion, à la suspension d'un membre, au changement de
  statut d'entreprise (`revokeAllSessions`).
- `requireUser()` renvoie une **erreur de redirection** (jamais une page vide) : vers
  `/login` sans session, vers `/suspended` si l'entreprise est inactive (page hors du
  groupe `/app` pour éviter toute boucle), vers `/admin` pour un administrateur plateforme.
- Les permissions effectives sont calculées à chaque requête à partir du rôle et des
  surcharges `role_permissions`, puis mises en cache pour la durée du rendu.

---

## 8. Rôles et permissions

- **7 rôles entreprise** : `owner` (Administrateur principal),
  `communication_manager` (Responsable communication), `editor` (Éditeur), `designer`
  (Graphiste), `community_manager`, `analyst` (Analyste), `viewer` (Lecteur).
  Plus le rôle technique `platform_admin` (sans entreprise).
- **33 permissions** nommées `domaine.action` (`content.view`, `content.edit`,
  `content.publish`, `catalog.manage`, `team.manage`, `settings.manage`, …).
- **Matrice par défaut** dans `DEFAULT_ROLE_PERMISSIONS` ; une entreprise ne stocke que
  ses **écarts** dans `role_permissions` (`allowed = 0|1`) — pas de copie de matrice.
- `hasPermission(permissions, requis)` applique une **sémantique OU** sur une liste :
  un utilisateur ayant l'une des permissions demandées passe.
- `permissionGroups()` alimente l'écran de configuration (12 groupes) et exclut
  `platform.manage`, non délégable à une entreprise.

---

## 9. Console plateforme (BATIANA TECH)

- Accessible uniquement via `requirePlatformAdmin()` (rôle `platform_admin`).
- Périmètre : entreprises (création implicite par inscription, plan, abonnement,
  renouvellement, quota, statut), membres (métadonnées), volumétrie, journal d'audit
  global, suppression avec saisie du nom exact de l'entreprise.
- Actions journalisées : `platform.company_updated`, `platform.company_deleted`,
  `platform.company_inspected`, `platform.admin_created`.
- Un administrateur plateforme **ne peut pas** ouvrir un contenu, un contact ou un fichier
  d'une entreprise cliente : aucune route ne l'autorise.

---

## 10. Médias et stockage

- Upload : MIME sur liste blanche, taille ≤ 10 Mo, catégorie déduite (`image`, `logo`,
  `video`, `document`, `audio`), rangement par dossier libre.
- Quota : somme de `size_bytes` par entreprise comparée à `companies.storage_quota_mb`.
- Lecture : jamais d'URL statique publique pour un fichier client.
  - `/api/v1/media/{id}/raw` — session ou clé API, contrôle `company_id`.
  - `/api/shop/{slug}/media/{id}` — uniquement les images `is_public` d'une entreprise
    dont la boutique est active.
- Export : les fichiers sont exportés en métadonnées ; le binaire reste consultable
  individuellement.

---

## 11. Centre IA

- `AI_PROVIDERS` décrit chaque fournisseur : protocole (`openai`, `anthropic`, `google`),
  URL de base, modèle par défaut, statut, documentation.
- `resolveAiConfig(companyId)` applique la priorité **clé d'entreprise → clé
  d'environnement → aucune**. La clé d'entreprise est stockée chiffrée (`ai.api_key`).
- `callProvider()` lève `AI_NOT_CONFIGURED` si aucune clé : l'action transforme cette
  erreur en message explicite. **Aucune génération factice n'est produite.**
- `buildPrompts()` assemble le rôle système (règles de plateforme, ton, langue) et la
  consigne utilisateur (brief, audience, mots-clés, contexte, texte source).
- Chaque génération est enregistrée (`ai_generations`) et peut être convertie en contenu
  via un classement `kind → type de contenu`.

---

## 12. Analytics : la définition du « réel »

Une valeur n'apparaît que si elle a une source :

| Indicateur | Source |
|---|---|
| Contenus créés / publiés / programmés | `contents` (dates réelles) |
| Contacts ajoutés, interactions | `contacts`, `contact_interactions` |
| Publications déclarées | `publications` (`published_at` renseigné) |
| Tâches terminées | `tasks` (`status = done`) |
| Portée / impressions / engagement | `analytics_snapshots` + `publication_metrics` saisis ou collectés |
| Comptes connectés | `social_accounts` avec jeton valide |

`resolvePeriod()` calcule la période courante et la période précédente de même longueur ;
l'écran affiche « — » lorsqu'aucune mesure n'existe pour une période, jamais un zéro
trompeur ni une valeur inventée. Les exports CSV et PDF reprennent exactement les mêmes
chiffres.

---

## 13. Migrations

- Fichiers `db/migrations/0001_init.sql`, `0002_*.sql`, … appliqués dans l'ordre.
- `src/lib/db.ts` applique les migrations manquantes au premier accès, chacune dans une
  transaction, et les enregistre dans `migrations(name, applied_at)`.
- `scripts/migrate.mjs` reproduit exactement cette logique en CLI (`--status`, `--reset`).
- Le build et les tests utilisent le même dossier : le schéma de test est celui de
  production.

---

## 14. Performance

- Requêtes préparées SQLite (plan mis en cache), `WAL` activé, `busy_timeout` à 5 s.
- Pagination par `LIMIT/OFFSET` sur toutes les listes (`pagination()` plafonne à 100).
- Rendu serveur : aucun chargement d'écran vide puis remplissage côté client.
- JavaScript client limité aux composants réellement interactifs (recherche, confirmation,
  copie, divulgation, sidebar mobile).
- Index alignés sur les filtres réels, pas de dénormalisation prématurée.

---

## 15. Chemins d'évolution

| Besoin | Chemin prévu |
|---|---|
| PostgreSQL | Réécrire `src/lib/db.ts` (même surface `all/get/run/count/transaction`) ; le SQL est standard. |
| Stockage objet | Remplacer le couple `data`/`external_url` de `media` par une clé S3 ; les routes de lecture restent identiques. |
| Internationalisation | Extraire `format.ts` et `permissions.ts` vers des catalogues de messages ; `middleware` de locale + segment `[locale]`. |
| Envoi réel sur les réseaux | Implémenter l'appel HTTP dans l'adaptateur de `SOCIAL_PLATFORMS` et basculer `publications.method` de `manual` à `api`. |
| Notifications e-mail | Brancher un fournisseur dans la couche notifications ; l'audit et le centre de notifications existent déjà. |
| Multi-instances | Passer à PostgreSQL puis extraire les workers d'envoi. |

---

## 16. Stratégie de tests

| Suite | Portée |
|---|---|
| `tests/crypto.test.mjs` | Chiffrement/déchiffrement AES-GCM, intégrité (altération détectée), masquage, `scrypt`. |
| `tests/permissions.test.mjs` | Matrice par défaut, surcharges, sémantique OU, couverture des groupes. |
| `tests/format.test.mjs` | Formatage monétaire, dates, initiales, référentiels complets. |
| `tests/csv.test.mjs` | Échappement des guillemets/sauts de ligne, BOM UTF-8, séparateur. |
| `tests/schema.test.mjs` | Migrations réelles en mémoire : isolation `company_id`, index, cascade, unicité, clés étrangères, survie de l'audit, absence de données fictives. |

Les modules `lib` sont purs : ils s'importent directement en TypeScript sous Node, sans
bundler ni mock HTTP. `npm run typecheck` complète la suite pour la sûreté des types.
