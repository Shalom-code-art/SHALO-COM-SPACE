# API REST v1 — SHALO COM SPACE

Interface d'intégration destinée aux scripts internes, outils BI et connecteurs de
l'entreprise. Toutes les données renvoyées sont **celles de l'entreprise authentifiée** :
aucune ressource n'est accessible sans identité valide, et aucune requête ne peut dépasser
le périmètre du tenant.

- Base : `https://<votre-domaine>/api/v1`
- Format : JSON UTF-8 (`{ "data": … }`), sauf exports CSV/PDF et fichiers binaires.
- Toutes les réponses portent `cache-control: no-store`.

---

## 1. Authentification

Deux modes sont acceptés, avec les mêmes règles de permissions.

### 1.1 Clé API (recommandé pour les intégrations)

```
Authorization: Bearer shalo_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Création : `/app/settings` → section **Clés API**. La valeur en clair n'est affichée
  qu'une seule fois ; seule son empreinte SHA-256 est conservée en base.
- Portée : les permissions du rôle `owner`, **moins** `platform.manage`.
  Une clé API ne peut donc jamais administrer la plateforme.
- Révocation immédiate depuis le même écran ; `last_used_at` est mis à jour à chaque appel.
- Une entreprise dont le statut n'est pas `active` est refusée (HTTP 403, `company_inactive`).

### 1.2 Session navigateur

Les routes d'export (`/api/v1/export/data`, `/api/v1/reports/export`, `/api/v1/reports/pdf`,
`/api/v1/contacts/export`, `/api/v1/media/{id}/raw`) acceptent le cookie de session
`shalo_session` afin d'être utilisables directement depuis l'interface.

Ces routes d'export **refusent volontairement les clés API** (HTTP 403) : elles produisent
un volume complet de données et exigent un utilisateur interactif identifié. Pour un usage
régulier en machine, interrogez l'API en lecture (§4) ou lancez l'export depuis
`/app/settings` → Données.

---

## 2. Format des réponses

### Succès — liste

```json
{
  "data": [ { "id": "ct_01H…", "title": "…" } ],
  "pagination": { "total": 128, "limit": 25, "offset": 0 }
}
```

### Succès — élément

```json
{ "data": { "id": "ct_01H…", "title": "…" } }
```

### Erreur

```json
{ "error": { "code": "forbidden", "message": "Permission insuffisante pour cette ressource." } }
```

| HTTP | `code` | Signification |
|---|---|---|
| 401 | `unauthenticated` | Aucune session et aucune clé API fournie. |
| 401 | `invalid_key` | Clé API inconnue ou révoquée. |
| 403 | `forbidden` | L'identité n'a pas la permission requise. |
| 403 | `no_company` | Compte plateforme : ressource réservée aux entreprises. |
| 403 | `company_inactive` | Entreprise suspendue, archivée ou en fin d'abonnement. |
| 404 | `not_found` | Ressource inexistante **ou appartenant à une autre entreprise**. |

Le code 404 est volontairement utilisé pour les objets d'une autre entreprise : l'API ne
révèle pas l'existence d'une ressource hors périmètre.

---

## 3. Pagination et filtres communs

| Paramètre | Type | Défaut | Règles |
|---|---|---|---|
| `limit` | entier | `25` | Borné entre 1 et 100. Valeur non numérique → défaut. |
| `offset` | entier | `0` | ≥ 0. |
| `q` | texte | — | Recherche `LIKE` sur les champs texte de la ressource. |
| `from` / `to` | date `YYYY-MM-DD` | 30 derniers jours | Utilisés par les endpoints analytiques. |

Toutes les valeurs sont liées en paramètres SQL : aucune concaténation, donc aucune
injection possible.

---

## 4. Endpoints

### 4.1 `GET /api/v1/me`

Identité de l'appelant, mode d'authentification, permissions effectives et fiche résumée
de l'entreprise. Aucune permission particulière requise au-delà d'une identité valide.

```json
{
  "data": {
    "actor": { "id": "u_01H…", "name": "Awa Nkogo", "role": "owner" },
    "via": "api_key",
    "permissions": ["dashboard.view", "content.view", "…"],
    "company": {
      "id": "co_01H…",
      "name": "Studio Mbeng",
      "slug": "studio-mbeng",
      "plan": "pro",
      "subscription_status": "active",
      "status": "active"
    }
  }
}
```

### 4.2 `GET /api/v1/contents`

Contenus **non archivés**. Permission : `content.view`.

| Paramètre | Valeurs | Effet |
|---|---|---|
| `status` | `draft`, `review`, `approved`, `scheduled`, `published`, `rejected`, `archived` | Filtre exact. |
| `type` | ex. `post`, `article`, `story`, `reel`… | Filtre exact sur le type de contenu. |
| `q` | texte | Titre, corps ou étiquettes. |

Tri : `updated_at` décroissant. Champs renvoyés : `id`, `type`, `title`, `status`, `tone`,
`language`, `campaign_id`, `assignee_id`, `author_id`, `scheduled_at`, `published_at`,
`tags`, `source`, `created_at`, `updated_at` (le corps n'est pas inclus dans les listes).

```bash
curl -s "https://exemple.com/api/v1/contents?status=scheduled&limit=50" \
  -H "Authorization: Bearer $SHALO_KEY"
```

### 4.3 `GET /api/v1/contents/{id}`

Contenu complet + commentaires + révisions (20 dernières) + médias liés.
Permission : `content.view`.

```json
{
  "data": {
    "content": { "id": "ct_01H…", "title": "…", "body": "…", "status": "review" },
    "comments": [ { "id": "cm_01H…", "author_id": "u_01H…", "body": "…", "created_at": "…" } ],
    "revisions": [ { "id": "rv_01H…", "title": "…", "author_id": "u_01H…", "created_at": "…" } ],
    "media": [ { "id": "md_01H…", "name": "visuel.png", "mime": "image/png", "kind": "image" } ]
  }
}
```

### 4.4 `GET /api/v1/contacts`

Permission : `contacts.clients.view` pour `kind=client` (défaut),
`contacts.employees.view` pour `kind=employee`. Les deux annuaires ne sont jamais mélangés.

| Paramètre | Valeurs | Effet |
|---|---|---|
| `kind` | `client` \| `employee` | Sélectionne l'annuaire et la permission associée. |
| `q` | texte | Nom, email, téléphone. |
| `category` | texte | Clients uniquement. |
| `department` | texte | Collaborateurs uniquement. |

Champs : `id`, `kind`, `name`, `phone`, `whatsapp`, `email`, `company_name`, `category`,
`job_title`, `department`, `manager_name`, `tags`, `consent_email`, `consent_whatsapp`,
`consent_source`, `created_at`, `updated_at`. Tri : `name`.

### 4.5 `GET /api/v1/campaigns`

Permission : `campaign.view`. Filtres : `status`, `type`, `q` (nom, objectif, audience,
canaux). Tri : date de début décroissante.

### 4.6 `GET /api/v1/products`

Permission : `catalog.view`. Filtres : `kind` (`product` \| `service`), `availability`
(`in_stock`, `out_of_stock`, `preorder`, `discontinued`), `category` (identifiant),
`q` (nom, description, référence). Tri : `position`, puis `name`.

### 4.7 `GET /api/v1/analytics/summary`

Permission : `analytics.view`. Paramètres : `from`, `to` (`YYYY-MM-DD`).
Sans paramètres, les 30 derniers jours sont utilisés, comparés aux 30 jours précédents.

```json
{
  "data": {
    "period": { "from": "2026-10-07", "to": "2026-11-05", "label": "7 oct. 2026 → 5 nov. 2026" },
    "current": { "contentsCreated": 12, "contentsPublished": 7, "contactsAdded": 3, "reach": 18400, "engagement": 1240 },
    "previous": { "contentsCreated": 9, "contentsPublished": 6, "contactsAdded": 2, "reach": 15120, "engagement": 980 },
    "contentsByStatus": [ { "status": "published", "total": 7 } ],
    "contentsByType": [ { "type": "post", "total": 5 } ],
    "campaignSummary": { "total": 4, "active": 1, "budgetCents": 250000, "byStatus": [ { "status": "active", "total": 1 } ] },
    "audienceByPlatform": [ { "platform": "facebook", "followers": 4200, "capturedOn": "2026-11-01", "source": "manual" } ],
    "platformActivity": [ { "platform": "facebook", "total": 9 } ],
    "accountsConnected": 1,
    "accountsTotal": 3,
    "snapshotCount": 4,
    "series": [ { "date": "2026-10-07", "created": 2, "published": 1 } ],
    "topContents": [ { "id": "ct_01H…", "title": "…", "platform": "facebook", "engagement": 320, "reach": 4100, "publishedAt": "2026-10-24T09:12:00.000Z" } ],
    "dataNotes": [ "…" ]
  }
}
```

Les valeurs de portée et d'engagement proviennent exclusivement des relevés saisis ou
collectés (`analytics_snapshots`, `publication_metrics`). Une période sans relevé renvoie
`0` et `snapshotCount: 0` — l'interface affiche alors « — » plutôt qu'un chiffre trompeur.

---

## 5. Exports

| Endpoint | Permission | Sortie |
|---|---|---|
| `GET /api/v1/reports/export?from=&to=` | `analytics.export` | CSV UTF-8 (BOM, séparateur `;`), sections Indicateurs / Mesures / Contexte / Répartition. |
| `GET /api/v1/reports/pdf?from=&to=` | `analytics.export` | PDF A4 (rapport de communication et marketing). |
| `GET /api/v1/contacts/export?kind=client\|employee` | `contacts.*.view` | CSV de l'annuaire concerné. |
| `GET /api/v1/export/data` | `settings.manage` | JSON complet de l'entreprise (voir ci-dessous). |
| `GET /api/v1/media/{id}/raw` | `media.view` | Fichier binaire de la médiathèque. |

Toutes les routes de cette section s'authentifient par **session** (cookie) : sans session
valide, la réponse est `403` en texte brut, jamais un flux partiel.

### Export complet des données

Sections : entreprise, paramètres (hors secrets), membres, contacts, interactions,
contenus, commentaires, campagnes, catégories, produits, comptes sociaux, publications,
médias (**métadonnées uniquement**), tâches, relevés analytiques, mesures de publication,
générations IA, journal d'audit.

- Les clés `ai.api_key` et tout hachage sont exclus.
- Nom de fichier : `shalo-<slug>-<AAAA-MM-JJ>.json`.
- L'opération est journalisée (`company.data_exported`).

---

## 6. Vitrine publique (hors API v1)

| Endpoint | Description |
|---|---|
| `GET /boutique/{slug}` | Page publique du catalogue (produits `is_public`, catégories, coordonnées). |
| `GET /api/shop/{slug}/media/{id}` | Image publique d'un produit, restreinte à l'entreprise `{slug}` et aux images publiables. |

Aucune donnée privée (contacts, contenus, analytics, membres) n'expose de route publique.

---

## 7. Limites et bonnes pratiques

- **Pas de création/modification via l'API v1 pour l'instant** : la v1 est en lecture et
  export ; les écritures passent par les Server Actions protégées de l'interface.
- `limit` plafonne à 100 : paginer plutôt que demander de gros volumes.
- Une clé API = un usage identifié (nommer les clés « BI », « Zapier »…), révoquée dès
  qu'elle n'est plus nécessaire.
- Ne jamais embarquer une clé `shalo_…` dans du code navigateur : elle donne accès à toutes
  les données de l'entreprise.
- Les erreurs d'authentification ne distinguent jamais « inexistant » de « non autorisé »
  au-delà du code indiqué.

---

## 8. Exemple complet (Node)

```js
const base = process.env.SHALO_BASE_URL; // https://exemple.com
const key = process.env.SHALO_API_KEY;   // shalo_…

async function get(path) {
  const response = await fetch(`${base}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(`${response.status} ${error.code}: ${error.message}`);
  }
  return response.json();
}

const me = await get("/me");
console.log(me.data.company.name, me.data.actor.name);

const scheduled = await get("/contents?status=scheduled&limit=100");
for (const item of scheduled.data) {
  console.log(item.scheduled_at, item.title);
}

const summary = await get("/analytics/summary?from=2026-10-01&to=2026-10-31");
console.log("Publiés :", summary.data.current.contentsPublished);
```
