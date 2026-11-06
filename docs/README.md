# Documentation — SHALO COM SPACE

Documentation de la plateforme, rédigée en français. Chaque document existe en deux formats :

- **Markdown** (`.md`) : source versionnable, lisible dans l'éditeur ou sur le dépôt ;
- **Word** (`.docx`) : version remise au client, avec page de garde, en-tête, pied de page paginé et tableaux mis en forme.

## Documents

| # | Sujet | Word | Source Markdown |
|---|---|---|---|
| 00 | Documentation complète (sommaire + six parties) | `00_SHALO_COM_SPACE_Documentation_complete.docx` | — |
| 01 | Présentation et installation | `01_Presentation_et_Installation.docx` | [`../README.md`](../README.md) |
| 02 | Architecture technique | `02_Architecture_technique.docx` | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 03 | API REST v1 | `03_API_REST_v1.docx` | [`API.md`](API.md) |
| 04 | Déploiement et exploitation | `04_Deploiement_et_Exploitation.docx` | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| 05 | Guide utilisateur | `05_Guide_Utilisateur.docx` | [`USER_GUIDE.md`](USER_GUIDE.md) |
| 06 | Résultats de vérification | `06_Resultats_de_Verification.docx` | [`TEST_RESULTS.md`](TEST_RESULTS.md) |

Le schéma de la base se trouve dans [`../db/migrations/0001_init.sql`](../db/migrations/0001_init.sql).

## Régénérer les fichiers Word

```bash
npm run docs:word
```

Le script `scripts/build-docs-docx.mjs` relit les sources Markdown et réécrit les sept fichiers `.docx`
dans ce dossier. Il gère les titres, paragraphes, listes (y compris imbriquées), tableaux, blocs de
code, citations, liens et mises en forme en ligne (gras, code, italique). Aucun logiciel externe
(Pandoc, suite bureautique) n'est nécessaire : seule la dépendance de développement `docx` est utilisée.

Après modification d'un document, mettre à jour le `.md` puis relancer la commande : le `.docx`
correspondant est remplacé et reste ainsi aligné sur le contenu réel du produit.

## Conventions de rédaction

- Décrire uniquement ce que l'application fait réellement ; signaler explicitement les intégrations
  qui restent à configurer (clés d'IA, applications Meta/LinkedIn/TikTok/Google, fournisseur e-mail).
- Ne jamais présenter une action simulée comme réelle (publication sociale, envoi d'e-mail, paiement).
- Indiquer les chemins d'accès (`/app/...`, `/admin`, `/api/v1/...`) et les rôles concernés.
- Conserver la terminologie de l'interface (« Contenus », « Calendrier », « Campagnes », « Vitrine »).
