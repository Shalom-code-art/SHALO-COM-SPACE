#!/usr/bin/env node
/**
 * Jeu de donnees de demonstration LOCAL.
 *
 * Objectif : disposer d'un espace de travail peuplE pour la prise en main et la
 * verification visuelle de l'interface. Ce script n'est jamais appele par
 * l'application, ni par les migrations, ni par un deploiement : une base neuve
 * reste totalement vide (exigence "aucune donnee fictive" en production).
 *
 * Usage :
 *   node scripts/seed-demo.mjs
 *   DEMO_PASSWORD=MonMotDePasse node scripts/seed-demo.mjs
 *
 * Securite :
 *   - refuse de s'executer si NODE_ENV=production ;
 *   - refuse de s'executer si la base contient deja des utilisateurs.
 */
import { get, newId, nowIso, run } from "../src/lib/db.ts";
import { hashPassword, randomToken } from "../src/lib/crypto.ts";

if (process.env.NODE_ENV === "production") {
  console.error("Refus : ce script de demonstration ne doit jamais tourner en production.");
  process.exit(1);
}

const existing = get("SELECT COUNT(*) AS total FROM users");
if (existing && Number(existing.total) > 0) {
  console.error(`Refus : ${existing.total} utilisateur(s) existent deja dans cette base.`);
  console.error("Utilisez une base vide, ou supprimez data/shalo.db pour repartir de zero.");
  process.exit(1);
}

const ts = nowIso();
const day = (offset) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString();
};

const demoPassword = process.env.DEMO_PASSWORD?.trim() || `Demo-${randomToken(4)}`;
const adminPassword = `Admin-${randomToken(4)}`;

// ------------------------------------------------------------------ Entreprise
const companyId = newId();
run(
  `INSERT INTO companies (id, name, slug, legal_name, email, phone, address, city, country, website,
     shop_tagline, shop_about, primary_color, secondary_color, plan, subscription_status, status, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [
    companyId,
    "Espace démo SHALO",
    "shalo-demo",
    "Espace démo SHALO SARL",
    "contact@shalo.demo",
    "+241 00 00 00 00",
    "Boulevard Triomphal",
    "Libreville",
    "Gabon",
    "https://shalo.demo",
    "Communication, création et croissance pour les entreprises gabonaises.",
    "Espace de démonstration créé pour découvrir les modules de SHALO COM SPACE : contenus, calendrier, campagnes, contacts, catalogue et analytics. Toutes les données de cet espace sont fictives.",
    "#1259A8",
    "#F5821F",
    "business",
    "active",
    "active",
    ts,
    ts,
  ]
);

const settings = {
  "ai.provider": "openai",
  "ai.model": "gpt-4o-mini",
  "ai.temperature": "0.7",
  "notifications.publication": "1",
  "notifications.campaign": "1",
  "notifications.team": "1",
  "privacy.policy": "1",
};
for (const [key, value] of Object.entries(settings)) {
  run("INSERT INTO company_settings (company_id, key, value) VALUES (?,?,?)", [companyId, key, value]);
}

// ------------------------------------------------------------------ Utilisateurs
const ownerId = newId();
run(
  `INSERT INTO users (id, company_id, name, email, password_hash, role, status, job_title, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?)`,
  [
    ownerId,
    companyId,
    "Compte Démo",
    "demo@shalo.local",
    hashPassword(demoPassword),
    "owner",
    "active",
    "Responsable communication",
    ts,
    ts,
  ]
);

const editorId = newId();
run(
  `INSERT INTO users (id, company_id, name, email, password_hash, role, status, job_title, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?)`,
  [
    editorId,
    companyId,
    "Exemple Rédacteur",
    "redacteur@shalo.local",
    hashPassword(demoPassword),
    "editor",
    "active",
    "Rédacteur",
    ts,
    ts,
  ]
);

run(
  `INSERT INTO users (id, company_id, name, email, password_hash, role, status, job_title, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?)`,
  [newId(), null, "Administrateur BATIANA TECH", "admin@shalo.local", hashPassword(adminPassword), "platform_admin", "active", "Plateforme", ts, ts]
);

// ------------------------------------------------------------------ Campagne
const campaignId = newId();
run(
  `INSERT INTO campaigns (id, company_id, name, type, objective, description, audience, start_date, end_date,
     budget_cents, currency, channels, status, owner_id, kpi_target, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [
    campaignId,
    companyId,
    "Rentrée 2026",
    "promotion",
    "Générer 120 demandes de devis en quatre semaines.",
    "Campagne de rentrée : mise en avant des offres de création de contenu et d'accompagnement digital.",
    "PME de Libreville et Port-Gentil",
    day(-7),
    day(21),
    750000,
    "XAF",
    "facebook,instagram,whatsapp",
    "active",
    ownerId,
    120,
    ts,
    ts,
  ]
);

// ------------------------------------------------------------------ Contenus
const contents = [
  {
    type: "post",
    title: "Trois idées de publications pour la rentrée",
    body: "La rentrée est le bon moment pour reprendre la parole : annoncez vos nouveautés, partagez un conseil utile et présentez votre équipe. Un rythme de deux publications par semaine suffit pour rester visible sans saturer votre audience.",
    tone: "professional",
    status: "published",
    scheduled: day(-5),
    published: day(-5),
    tags: "rentrée,calendrier",
  },
  {
    type: "announcement",
    title: "Nouvelle offre : accompagnement digital mensuel",
    body: "Nous lançons un accompagnement mensuel : audit de vos canaux, calendrier éditorial, production de contenus et rapport de performance. Les places sont limitées pour cette première cohorte.",
    tone: "inspiring",
    status: "scheduled",
    scheduled: day(3),
    published: null,
    tags: "offre,services",
  },
  {
    type: "ad_text",
    title: "Publicité — Pack visibilité 30 jours",
    body: "Votre entreprise mérite d'être vue. Avec le Pack visibilité, bénéficiez de 30 jours de contenus prêts à publier, d'un calendrier clair et d'un suivi des résultats. Demandez votre devis dès aujourd'hui.",
    tone: "persuasive",
    status: "in_review",
    scheduled: null,
    published: null,
    tags: "publicité,pack",
  },
  {
    type: "video_script",
    title: "Script — Présentation de l'équipe en 45 secondes",
    body: "Plan 1 : plan large sur l'équipe au travail. Voix off : « Derrière chaque publication, il y a une équipe qui écoute vos clients. » Plan 2 : gros plan sur l'écran de préparation du calendrier. Plan 3 : plan sur le sourire de l'équipe, signature visuelle.",
    tone: "friendly",
    status: "draft",
    scheduled: null,
    published: null,
    tags: "vidéo,équipe",
  },
];

for (const item of contents) {
  const contentId = newId();
  run(
    `INSERT INTO contents (id, company_id, type, title, body, tone, language, status, campaign_id, author_id,
       scheduled_at, published_at, tags, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      contentId,
      companyId,
      item.type,
      item.title,
      item.body,
      item.tone,
      "fr",
      item.status,
      campaignId,
      ownerId,
      item.scheduled,
      item.published,
      item.tags,
      "manual",
      ts,
      ts,
    ]
  );
  run(
    "INSERT INTO content_revisions (id, content_id, company_id, title, body, author_id, created_at) VALUES (?,?,?,?,?,?,?)",
    [newId(), contentId, companyId, item.title, item.body, ownerId, ts]
  );
}

// ------------------------------------------------------------------ Contacts
const contacts = [
  {
    kind: "client",
    name: "Société Exemple",
    phone: "+241 01 02 03 04",
    email: "contact@societe-exemple.ga",
    companyName: "Société Exemple",
    category: "PME",
    tags: "prospect,libreville",
    consentEmail: 1,
    consentWhatsapp: 1,
  },
  {
    kind: "client",
    name: "Client Démonstration",
    phone: "+241 05 06 07 08",
    email: "client@demo.ga",
    companyName: "Cabinet Démo",
    category: "Services",
    tags: "client-actif",
    consentEmail: 1,
    consentWhatsapp: 0,
  },
  {
    kind: "employee",
    name: "Collaborateur Exemple",
    phone: "+241 09 08 07 06",
    email: "collaborateur@shalo.demo",
    companyName: "Espace démo SHALO",
    category: "Communication",
    tags: "équipe",
    consentEmail: 0,
    consentWhatsapp: 0,
  },
];

for (const contact of contacts) {
  run(
    `INSERT INTO contacts (id, company_id, kind, name, phone, email, company_name, category, tags,
       consent_email, consent_whatsapp, consent_source, consent_at, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      companyId,
      contact.kind,
      contact.name,
      contact.phone,
      contact.email,
      contact.companyName,
      contact.category,
      contact.tags,
      contact.consentEmail,
      contact.consentWhatsapp,
      contact.consentEmail || contact.consentWhatsapp ? "Formulaire site web" : null,
      contact.consentEmail || contact.consentWhatsapp ? ts : null,
      ownerId,
      ts,
      ts,
    ]
  );
}

// ------------------------------------------------------------------ Catalogue
const categoryId = newId();
run("INSERT INTO product_categories (id, company_id, name, position) VALUES (?,?,?,?)", [
  categoryId,
  companyId,
  "Accompagnement",
  0,
]);

const products = [
  {
    kind: "service",
    name: "Pack visibilité 30 jours",
    price: 250000,
    availability: "in_stock",
    featured: 1,
    description: "30 jours de contenus prêts à publier, calendrier éditorial et suivi des résultats.",
  },
  {
    kind: "service",
    name: "Audit de communication digitale",
    price: 150000,
    availability: "in_stock",
    featured: 0,
    description: "Analyse de vos canaux, de votre audience et de vos contenus, avec recommandations.",
  },
  {
    kind: "product",
    name: "Guide de la communication locale (PDF)",
    price: 25000,
    availability: "in_stock",
    featured: 1,
    description: "Guide pratique : construire un calendrier éditorial adapté au marché gabonais.",
  },
];

for (const [index, product] of products.entries()) {
  run(
    `INSERT INTO products (id, company_id, kind, name, category_id, description, price_cents, currency,
       availability, featured, is_public, position, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      companyId,
      product.kind,
      product.name,
      categoryId,
      product.description,
      product.price,
      "XAF",
      product.availability,
      product.featured,
      1,
      index,
      ts,
      ts,
    ]
  );
}

// ------------------------------------------------------------------ Equipe / notifications
run(
  `INSERT INTO tasks (id, company_id, title, description, assignee_id, due_date, priority, status, created_by, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  [
    newId(),
    companyId,
    "Valider le calendrier de la rentrée",
    "Relire les quatre contenus programmés et confirmer les dates de publication.",
    editorId,
    day(2).slice(0, 10),
    "high",
    "in_progress",
    ownerId,
    ts,
    ts,
  ]
);
run(
  `INSERT INTO tasks (id, company_id, title, description, assignee_id, due_date, priority, status, created_by, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  [
    newId(),
    companyId,
    "Préparer le rapport de campagne",
    "Extraire le rapport PDF de la campagne « Rentrée 2026 » pour la réunion hebdomadaire.",
    ownerId,
    day(6).slice(0, 10),
    "normal",
    "todo",
    ownerId,
    ts,
    ts,
  ]
);

const notifications = [
  {
    type: "content",
    title: "Contenu publié : « Trois idées de publications pour la rentrée »",
    body: "Publication confirmée manuellement depuis le studio de contenu.",
    link: "/app/contents",
  },
  {
    type: "campaign",
    title: "Campagne « Rentrée 2026 » en cours",
    body: "Objectif : 120 demandes de devis jusqu'au " + day(21).slice(0, 10) + ".",
    link: "/app/campaigns",
  },
];
for (const notification of notifications) {
  run(
    "INSERT INTO notifications (id, company_id, user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), companyId, ownerId, notification.type, notification.title, notification.body, notification.link, ts]
  );
}

run(
  "INSERT INTO audit_logs (id, company_id, actor_id, actor_name, actor_role, action, entity, entity_id, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  [newId(), companyId, ownerId, "Compte Démo", "owner", "company.created", "company", companyId, "127.0.0.1", ts]
);

console.log("Espace de démonstration créé.\n");
console.log("  Entreprise :  Espace démo SHALO (slug: shalo-demo)");
console.log(`  Propriétaire : demo@shalo.local / ${demoPassword}`);
console.log(`  Rédacteur :    redacteur@shalo.local / ${demoPassword}`);
console.log(`  Admin plateforme : admin@shalo.local / ${adminPassword}`);
console.log("\nCes identifiants sont locaux (base data/shalo.db, ignoree par Git).");
console.log("Supprimez data/shalo.db pour repartir d'une base vide.");
