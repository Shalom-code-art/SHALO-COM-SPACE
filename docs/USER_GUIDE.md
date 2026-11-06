# Guide utilisateur — SHALO COM SPACE

Ce guide décrit l'utilisation quotidienne de la plateforme : connexion, rôles, chaque
module et les bons réflexes de sécurité. Il s'adresse aux utilisateurs de l'espace
entreprise comme à l'équipe BATIANA TECH qui administre la plateforme.

---

## 1. Se connecter

| Situation | Adresse |
|---|---|
| Utilisateur d'une entreprise | `/login` |
| Nouvelle entreprise | `/register` (crée l'entreprise et son compte principal) |
| Membre invité | lien reçu du responsable, valable 7 jours |
| Première installation | `/setup` — réservé à la création de l'administrateur BATIANA TECH |
| Plateforme (BATIANA TECH) | `/admin` après connexion |

- Mot de passe : 10 caractères minimum.
- Après **8 tentatives échouées**, le compte est temporairement bloqué pendant 15 minutes.
- Si l'espace de l'entreprise est suspendu, la connexion affiche la page `/suspended`
  (motif, statut d'abonnement) : contactez BATIANA TECH pour la réactivation.
- La session dure 7 jours. La déconnexion révoque immédiatement le jeton côté serveur.

---

## 2. Rôles et responsabilités

Sept rôles, définis par l'entreprise. Les droits peuvent être ajustés entreprise par
entreprise (voir §5, _Équipe & tâches_).

| Rôle | Usage typique | Droits |
|---|---|---|
| **Administrateur principal** (`owner`) | Dirigeant, responsable de l'espace | Tous les droits de l'entreprise, sauf l'administration de la plateforme. Seul rôle à pouvoir tout supprimer. |
| **Responsable communication** | Responsable du service | Pilote la stratégie, valide les contenus, encadre l'équipe, gère campagnes et contacts. |
| **Éditeur** | Rédacteur | Rédige et prépare les contenus, sans validation finale ni suppression. |
| **Graphiste** | Production visuelle | Produit les visuels, gère la médiathèque et les images du catalogue. |
| **Community manager** | Animation quotidienne | Publie et déclare les publications, gère les contacts clients et le calendrier. |
| **Analyste** | Suivi de performance | Consulte les données, saisit les relevés, produit les rapports. |
| **Lecteur** | Direction, prestataire externe | Consultation seule, aucun droit de modification. |

Chaque écran vérifie les droits **sur le serveur** : masquer un bouton ne suffit jamais,
et un utilisateur sans permission ne peut pas déclencher une action même en connaissant
l'URL.

---

## 3. Le quotidien, module par module

### 3.1 Tableau de bord — `/app`

Point d'entrée : indicateurs réels de l'entreprise (contenus, contacts, campagnes,
publications), activité récente, tâches assignées, raccourcis. Les chiffres sont calculés
sur vos données ; ils ne sont jamais préremplis.

### 3.2 Centre IA — `/app/ai`

1. Choisissez la **nature de la demande** (publication Facebook, Instagram, LinkedIn,
   message WhatsApp, texte publicitaire, description produit, slogan, idées de campagne,
   réécriture, traduction, calendrier éditorial, stratégie marketing, demande libre).
2. Renseignez la **plateforme**, le **ton**, la **langue**, puis un **brief** détaillé
   (objet, cible, offre, contraintes). Plus le brief est précis, plus le résultat est utile.
3. Générez. Le résultat s'affiche tel quel — **aucun contenu n'est inventé par défaut**.
4. Trois actions : **copier**, **convertir en contenu** (brouillon dans le studio),
   **supprimer** (retire la génération de l'historique).

> Sans clé de fournisseur, le bouton signale explicitement que la génération n'est pas
> configurée et renvoie vers _Paramètres → Intelligence artificielle_. Aucun faux résultat
> n'est produit.

### 3.3 Studio de contenus — `/app/content`

- **Créer** : type (10 types : publication, article, story, reel, carrousel, message,
  newsletter, texte publicitaire, description commerciale, annonce), titre, corps, ton,
  langue, campagne, média, assignation.
- **Cycle de vie** : `draft` → `review` → `approved` → `scheduled` → `published`
  (ou `rejected`). Chaque changement de statut est enregistré, et les révisions
  précédentes conservées.
- **Collaboration** : commentaires internes sur chaque contenu, tâches rattachées.
- **Actions** : dupliquer, archiver, supprimer (permission `content.delete`).
- **Depuis l'IA** : un contenu converti arrive en brouillon avec la source `ai`.

### 3.4 Calendrier éditorial — `/app/calendar`

Vues jour / semaine / mois. Un contenu programmé apparaît à sa date avec son statut
(couleur). Cliquez sur une entrée pour ouvrir le contenu. Le calendrier sert de vue de
planification : **il ne déclenche aucun envoi automatique**.

### 3.5 Réseaux sociaux — `/app/social`

Deux usages, clairement distingués :

1. **Connexion déclarée** — vous enregistrez le compte (plateforme, nom, référence). Si les
   identifiants officiels de la plateforme ne sont pas configurés côté serveur, le compte
   reste marqué « non connecté » : l'application ne prétend pas le contraire.
2. **Publication** — soit l'intégration officielle est active et l'envoi est effectué par
   l'API, soit vous publiez manuellement puis **déclarez la publication** (date, lien).
   Une publication déclarée est horodatée et comptée dans les analyses.

Les étapes manuelles recommandées sont affichées pour chaque plateforme.

### 3.6 Campagnes — `/app/campaigns`

Fiche complète : nom, type (7 types), objectif, description, audience, dates, budget,
devise, canaux, KPI cible, responsable, résultats. L'aide IA peut proposer des idées à
partir de la fiche. Le statut (`planned`, `active`, `paused`, `completed`, `cancelled`)
pilote le suivi et les indicateurs du tableau de bord.

### 3.7 Contacts clients et collaborateurs — `/app/contacts` et `/app/team-contacts`

Deux annuaires **strictement séparés** (permissions distinctes : une personne peut gérer
les clients sans voir les collaborateurs, et inversement).

- **Clients** : nom, société, catégorie, téléphone, WhatsApp, email, étiquettes, notes,
  **consentement** e-mail / WhatsApp (source et date).
- **Collaborateurs** : nom, fonction, service, responsable hiérarchique, coordonnées, notes.
- **Historique** : chaque échange (appel, email, WhatsApp, réunion, note) daté sur la fiche.
- **CSV** : import avec détection de doublons, export de l'annuaire courant.
- Le consentement est affiché sur la fiche : n'utilisez un contact pour une campagne que
  s'il a donné son accord pour le canal concerné.

### 3.8 Catalogue et boutique — `/app/catalog`

- Catégories ordonnées, produits **ou** services, référence, description, prix, devise,
  image, disponibilité, mise en avant, visibilité.
- **Aperçu public** : `/boutique/<slug>` présente le catalogue aux clients, sans paiement
  en ligne (hors périmètre de cette version).
- La vitrine ne montre que les éléments marqués publics et appartenant à l'entreprise
  dont la boutique est active.

### 3.9 Médiathèque — `/app/media`

- Import par glisser-déposer ou sélection : images, logos, vidéos, documents, audio.
- 10 Mo maximum par fichier, quota mensuel/global défini par BATIANA TECH (visible dans
  _Paramètres → Entreprise_).
- Organisation par dossiers et étiquettes ; les fichiers se lient aux contenus et aux
  produits.
- Suppression réservée à la permission `media.delete` ; un fichier utilisé par un contenu
  reste consultable tant que le contenu existe.

### 3.10 Analytics et rapports — `/app/analytics`

- Période sélectionnable, comparaison avec la période précédente de même longueur.
- Indicateurs issus de vos données : contenus créés/publiés/programmés, contacts ajoutés,
  interactions, publications déclarées, tâches terminées, campagnes actives.
- Mesures d'audience (portée, impressions, engagement) : issues des **relevés saisis** ou
  collectés. Sans relevé, l'écran affiche « — » plutôt qu'un chiffre inventé.
- **Exports** : CSV (tableur) et PDF (rapport prêt à transmettre).
- Saisie des relevés : permission `analytics.manage`.

### 3.11 Équipe et tâches — `/app/team`

- **Inviter** un membre : rôle choisi à l'invitation, lien valable 7 jours, révocable.
- **Changer de rôle**, **suspendre** un membre (ses sessions sont immédiatement révoquées).
- **Matrice de permissions** : ajustez les droits par rôle pour votre entreprise. Seuls les
  écarts par rapport à la matrice par défaut sont enregistrés ; un bouton permet de revenir
  aux valeurs par défaut.
- **Tâches** : titre, description, responsable, échéance, priorité, rattachement à un
  contenu ou une campagne, statut.
- Le compte `owner` ne peut pas être le dernier à perdre ce rôle : la plateforme empêche de
  se retrouver sans administrateur principal.

### 3.12 Paramètres — `/app/settings`

| Section | Contenu |
|---|---|
| **Entreprise** | Identité légale, coordonnées, couleurs, logo, boutique (activation, slogan, présentation), quota de stockage consommé. |
| **Intelligence artificielle** | Fournisseur, modèle, clé API (chiffrée, masquée après saisie), test de configuration. |
| **Notifications** | Choix des alertes internes reçues. |
| **Sécurité** | Mot de passe, déconnexion de toutes les sessions, informations de session. |
| **Clés API** | Création, nommage et révocation des clés `shalo_…` (affichées une seule fois). |
| **Données** | Export JSON complet de l'entreprise, rappels de sauvegarde. |
| **Journal d'audit** | Historique horodaté des actions (acteur, action, entité, IP). |

---

## 4. Console BATIANA TECH — `/admin`

Réservée aux administrateurs plateforme (rôle `platform_admin`, sans entreprise).

- **Vue d'ensemble** : nombre d'entreprises, d'utilisateurs, de contenus, stockage total,
  demandes de suppression, espaces suspendus, abonnements à renouveler sous 30 jours.
- **Entreprises** : recherche, filtre par statut, fiche détaillée (plan, abonnement, date de
  renouvellement, quota de stockage, membres, volumétrie, journal de l'entreprise).
- **Actions** : changer le plan, le statut d'abonnement, le statut de l'espace, le quota ;
  supprimer une entreprise en saisissant son nom exact (irréversible).
- **Journal global** : toutes les actions, y compris les interventions de BATIANA TECH.

**Limite volontaire** : la console n'affiche que des **métadonnées**. Un administrateur
plateforme ne peut pas ouvrir un contenu, un contact, un fichier ou un rapport d'une
entreprise. Chaque consultation de fiche est journalisée.

---

## 5. Bonnes pratiques

- Une personne = un compte. Les comptes partagés rendent le journal d'audit inutilisable.
- Attribuez le rôle le plus faible qui permet de travailler ; ajustez la matrice plutôt que
  de donner `owner`.
- Révoquez immédiatement le lien d'invitation d'un membre qui ne l'a pas utilisé.
- Vérifiez le **consentement** d'un contact avant toute campagne e-mail ou WhatsApp.
- Exportez régulièrement les rapports et les données (CSV/PDF, export JSON).
- Créez une clé API par usage ; révoquez celles qui ne servent plus.
- Ne communiquez jamais une clé API `shalo_…` : elle donne accès à toutes les données de
  l'entreprise.

---

## 6. Ce que l'application ne fait pas (par choix)

- Elle **n'envoie pas** de publication sur un réseau social sans intégration officielle
  configurée : dans ce cas, vous publiez puis déclarez la publication.
- Elle **ne génère pas** de texte sans fournisseur IA configuré.
- Elle **n'affiche pas** de statistiques inventées : sans relevé, la valeur est absente.
- Elle **ne vend pas en ligne** dans cette version : la boutique présente le catalogue.
- Elle **n'envoie pas d'e-mail** automatique (invitations par lien à transmettre).

---

## 7. Questions fréquentes

**Je ne vois pas un module dans le menu.**
Le menu n'affiche que les modules autorisés par votre rôle. Demandez à l'administrateur
principal d'ajuster la matrice de permissions.

**J'ai perdu mon mot de passe.**
Aucune réinitialisation par e-mail n'est active (aucun fournisseur d'envoi configuré).
L'administrateur principal peut changer votre rôle ou vous inviter à nouveau ; sinon,
BATIANA TECH peut intervenir via la console.

**Pourquoi le Centre IA refuse-t-il de générer ?**
Aucune clé fournisseur n'est enregistrée. Ajoutez-la dans _Paramètres → Intelligence
artificielle_, ou contactez BATIANA TECH pour une clé d'instance.

**Pourquoi un compte social apparaît-il « non connecté » ?**
Les identifiants officiels de la plateforme ne sont pas configurés sur cette instance.
La procédure manuelle reste disponible ; le statut sera mis à jour après configuration.

**Puis-je retrouver une version précédente d'un contenu ?**
Oui : les révisions sont conservées et consultables depuis la fiche du contenu.

**Mes chiffres semblent incomplets.**
Les indicateurs se basent sur les actions réellement enregistrées (statuts, dates,
publications déclarées, relevés saisis). Un contenu publié hors plateforme n'apparaît
qu'après déclaration.

---

## 8. En cas de problème

| Problème | À faire |
|---|---|
| Espace suspendu | Consulter `/suspended` pour le motif, contacter BATIANA TECH. |
| Action refusée malgré le bon rôle | Vérifier _Paramètres → Équipe → matrice de permissions_. |
| Fichier refusé à l'import | Vérifier le format (liste blanche) et le quota de stockage. |
| Export vide | La période choisie ne contient aucune donnée. |
| Résultat IA inutilisable | Enrichir le brief (cible, offre, contraintes) et préciser le ton. |

Support : BATIANA TECH — SHALO COM SPACE.
