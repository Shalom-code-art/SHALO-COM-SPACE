# Résultats de vérification — SHALO COM SPACE

Journal des contrôles réellement exécutés sur cette version. Chaque ligne correspond à une
commande ou à une requête effectivement lancée, avec son résultat.

- **Date** : 6 novembre 2026
- **Environnement** : Windows, Node.js `v27.0.0-alpha`, npm, build `next build` (standalone)
- **Base** : SQLite locale (`node:sqlite`), migrations appliquées au premier accès

---

## 1. Contrôles statiques

| Contrôle | Commande | Résultat |
|---|---|---|
| Types stricts | `node ./node_modules/typescript/bin/tsc --noEmit` | **0 erreur** |
| Build de production | `npm run build` | **Succès** — 40 routes compilées, sortie `standalone` |
| Avertissements de build | — | Aucun (l'avertissement `metadataBase` a été corrigé par `APP_URL`) |

Routes générées : `/`, `/login`, `/register`, `/setup`, `/suspended`, `/invitation/[token]`,
`/boutique/[slug]`, 12 pages `/app/**`, 4 pages `/admin/**`, 13 routes `/api/**`.

---

## 2. Tests automatisés

```bash
npm run test
```

Résultat : **35 tests — 35 réussis, 0 échec** (durée ≈ 0,63 s).

| Suite | Tests | Portée vérifiée |
|---|---|---|
| `tests/crypto.test.mjs` | 8 | Chiffrement AES-256-GCM, détection d'altération, masquage des secrets, `scrypt` (hash + vérification, sel distinct). |
| `tests/permissions.test.mjs` | 8 | Propriétaire = toutes les permissions sauf `platform.manage` ; administrateur plateforme = `platform.manage` seul ; 7 rôles ; sémantique OU ; surcharges d'entreprise ; couverture des groupes. |
| `tests/format.test.mjs` | 6 | Montants, dates, initiales, complétude des référentiels métier. |
| `tests/csv.test.mjs` | 6 | Échappement des `;`, guillemets et sauts de ligne, BOM UTF-8, valeurs nulles. |
| `tests/schema.test.mjs` | 7 | Migrations réelles sur base `:memory:` : `company_id` sur 22 tables métier, index, cascade de suppression, unicité/FK, survie du journal d'audit, **aucun `INSERT` dans les migrations**. |

---

## 3. Vérification d'exécution (serveur de production)

Serveur démarré avec `node .next/standalone/server.js`, base neuve, `APP_SECRET` défini.

### 3.1 Visiteur anonyme

| Requête | Résultat attendu | Observé |
|---|---|---|
| `GET /` | Page publique | **200** (66 Ko) |
| `GET /login` | Formulaire | **200** (20 Ko) |
| `GET /register` | Formulaire | **200** (23 Ko) |
| `GET /setup` | Création du premier administrateur plateforme | **200** (21 Ko) |
| `GET /suspended` | Redirection vers `/login` si non connecté | **307** |
| `GET /boutique/inexistante` | Boutique inconnue | **404** |
| `GET /app` | Redirection `/login` (proxy) | **307** |
| `GET /admin` | Redirection `/login` (proxy) | **307** |
| `GET /api/v1/me` | JSON 401 | **401** `unauthenticated` |
| `GET /api/v1/contents` | JSON 401 | **401** `unauthenticated` |
| `GET /api/v1/export/data` | Refus | **403** |

### 3.2 Utilisateur `owner` d'une entreprise (session)

| Requête | Résultat observé |
|---|---|
| `/app` | **200** (101 Ko) |
| `/app/ai` | **200** |
| `/app/content` | **200** |
| `/app/content/{id}` | **200** (contenu réel + commentaires/révisions) |
| `/app/calendar` | **200** |
| `/app/social` | **200** |
| `/app/campaigns` | **200** |
| `/app/contacts` | **200** |
| `/app/team-contacts` | **200** |
| `/app/catalog` | **200** |
| `/app/media` | **200** |
| `/app/analytics` | **200** (117 Ko, séries réelles) |
| `/app/team` | **200** |
| `/app/settings` (+ `?section=ai`, `?section=audit`) | **200** |
| `/app/search?q=alpha` | **200** |
| `/admin` | **307** (un `owner` n'accède pas à la console plateforme) |
| `/api/v1/me` | **200** (identité, droits, entreprise) |
| `/boutique/{slug}` | **200** (vitrine publique) |
| `/api/v1/export/data` | **200** `application/json` |
| `/api/v1/reports/export` | **200** `text/csv` |
| `/api/v1/reports/pdf` | **200** `application/pdf` |
| `/api/v1/contacts/export?kind=client` | **200** `text/csv` |
| `/api/v1/contacts/export?kind=employee` | **200** `text/csv` |

### 3.3 Administrateur plateforme (session)

| Requête | Résultat observé |
|---|---|
| `/admin` | **200** |
| `/admin/companies` (+ filtre `status=active`) | **200** |
| `/admin/companies/{id}` | **200** (fiche + journal + quota) |
| `/admin/audit` | **200** |
| `/app` | **307** (redirection vers la console plateforme) |
| `/api/v1/me` | **403** `no_company` (ressource réservée aux entreprises) |

### 3.4 API par clé (`Authorization: Bearer shalo_…`)

| Cas | Résultat observé |
|---|---|
| Clé valide — `/me`, `/contents`, `/contacts`, `/campaigns`, `/products`, `/analytics/summary` | **200**, données de l'entreprise |
| Isolation : clé de l'entreprise B sur `/contents` | **200** avec `data: []` (aucune fuite) |
| Isolation : clé B sur le contenu de A (`/contents/{id}`) | **404** (existence non révélée) |
| Clé inexistante | **401** `invalid_key` |
| Clé valide sur route d'export (`/export/data`) | **403** (exports réservés à une session) |

---

## 4. Migrations

| Commande | Résultat |
|---|---|
| `node scripts/migrate.mjs --status` (base déjà migrée) | `Disponibles : 1 · Appliquées : 1 · En attente : 0` |
| `node scripts/migrate.mjs` (base neuve) | `Appliquer : 0001_init.sql` → `Migrations appliquees avec succes`, code de sortie `0` |
| `--status` après application | `En attente : 0` |

---

## 5. Correctifs appliqués pendant cette vérification

| Problème détecté | Cause | Correction |
|---|---|---|
| Build : `Server Actions must be async functions` | `findDuplicate` (fonction synchrone) exportée depuis un fichier `"use server"` | Déplacée dans `src/lib/contacts.ts`, importée par l'action. |
| HTTP 500 sur **toutes** les routes | Runtime Node expérimental exposant `request.headers` sans prototype ; Next appelle `hasOwnProperty` | `src/instrumentation.ts` : correctif idempotent qui rétablit le prototype standard (sans effet sur Node 22/24 LTS). |
| Avertissement `metadataBase` | Absence d'URL de base | `APP_URL` + `metadataBase` dans `src/app/layout.tsx`. |
| Suite de tests : 1 échec sur `maskSecret` | Attente erronée (3 puces au lieu de 4) | Assertion corrigée. |

---

## 6. Non couvert par cette vérification

Ces points dépendent d'accès externes ou d'une interaction humaine et restent à valider en
recette :

- **Parcours par formulaire (Server Actions)** : création de contenu, invitation, upload,
  génération IA — à valider manuellement dans un navigateur (le rendu de toutes les pages a
  été vérifié, ainsi que la lecture en base).
- **Génération IA réelle** : aucune clé de fournisseur n'était configurée ; le refus
  explicite (`AI_NOT_CONFIGURED`) est le comportement attendu.
- **Publication réseau social** : aucune application officielle (Meta, LinkedIn, TikTok,
  Google) disponible ; seule la procédure manuelle déclarée est vérifiable.
- **Envoi d'e-mail** : aucun fournisseur configuré, donc hors périmètre.
- **Montée en charge** : non mesurée (volumétrie cible : une PME par entreprise).
