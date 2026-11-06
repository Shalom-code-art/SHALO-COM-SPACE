import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata = {
  title: "SHALO COM SPACE — Communiquer · Créer · Partager · Développer",
};

const MODULES = [
  { icon: "dashboard", title: "Tableau de bord", text: "Vue consolidée de vos publications, campagnes, contacts et statistiques." },
  { icon: "sparkles", title: "Centre IA", text: "Rédaction assistée pour Facebook, Instagram, LinkedIn, WhatsApp et vos supports." },
  { icon: "pen", title: "Studio de contenus", text: "Créer, classer, dupliquer, archiver et valider tous vos contenus." },
  { icon: "calendar", title: "Calendrier éditorial", text: "Vues jour, semaine et mois, affectation des responsables et statuts." },
  { icon: "share", title: "Réseaux sociaux", text: "Connexion officielle des comptes, préparation et suivi des publications." },
  { icon: "megaphone", title: "Campagnes marketing", text: "Objectifs, budgets, canaux, contenus associés et résultats." },
  { icon: "users", title: "Contacts & WhatsApp", text: "Répertoires séparés clients et collaborateurs, consentements, import CSV." },
  { icon: "store", title: "Catalogue & boutique", text: "Produits, services, catégories et vitrine publique personnalisable." },
  { icon: "folder", title: "Médiathèque", text: "Images, vidéos, documents et supports publicitaires centralisés." },
  { icon: "chart", title: "Analytics & rapports", text: "Indicateurs réels, comparaison de périodes, export PDF et CSV." },
  { icon: "user-plus", title: "Équipe communication", text: "Rôles, permissions configurables, tâches et historique des actions." },
  { icon: "settings", title: "Paramètres & administration", text: "Identité visuelle, abonnements, sécurité et journal d'audit." },
];

const SECURITY = [
  "Authentification par session sécurisée et mots de passe hachés (scrypt)",
  "Contrôle des permissions côté serveur sur chaque opération",
  "Isolation stricte des données entre entreprises clientes",
  "Chiffrement des jetons et clés API (AES-256-GCM), jamais exposés au navigateur",
  "Limitation des tentatives de connexion et révocation des accès",
  "Journal d'audit des opérations sensibles",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="SHALO COM SPACE" className="h-9 w-auto" />
          </div>
          <nav className="hidden items-center gap-6 text-[13px] font-medium text-ink-600 md:flex">
            <a href="#modules" className="hover:text-brand-700">Modules</a>
            <a href="#securite" className="hover:text-brand-700">Sécurité</a>
            <a href="#plateforme" className="hover:text-brand-700">Plateforme</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-sm sm:btn">Connexion</Link>
            <Link href="/register" className="btn btn-sm btn-primary sm:btn">
              Créer mon espace
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="grid-lines absolute inset-0 opacity-60" />
        <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[380px] w-[380px] rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-brand-100">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              Plateforme BATIANA TECH
            </span>
            <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-[44px]">
              Pilotez toute votre communication digitale depuis un seul espace.
            </h1>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-brand-100/85">
              SHALO COM SPACE réunit l'assistance IA, le studio de contenus, le calendrier éditorial,
              les réseaux sociaux, les campagnes, les contacts et le catalogue de votre entreprise.
              Une plateforme professionnelle, multi-entreprise et sécurisée.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn btn-accent">
                Créer mon espace entreprise <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
              <Link href="/login" className="btn border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10">
                Accéder à mon espace
              </Link>
            </div>
            <p className="mt-4 text-[11.5px] text-brand-200/70">
              Communiquer · Créer · Partager · Développer
            </p>
          </div>

          <div className="animate-rise rounded-2xl border border-white/12 bg-white/[0.06] p-4 shadow-[var(--shadow-pop)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <p className="text-[12px] font-medium text-brand-100">Tableau de bord — Aperçu</p>
              <span className="rounded-md bg-accent-500/90 px-2 py-0.5 text-[10px] font-semibold">IA active</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {[
                { label: "Publications", value: "Programmées" },
                { label: "Campagnes", value: "Actives" },
                { label: "Contacts", value: "Clients" },
                { label: "Contenus", value: "En validation" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-brand-200/70">{item.label}</p>
                  <p className="mt-1 text-[13px] font-medium text-white">{item.value}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-accent-400/80" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {["Publication Facebook — produit phare", "Campagne — lancement de service", "Relance WhatsApp — clients fidèles"].map(
                (row, index) => (
                  <div key={row} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "bg-emerald-400" : index === 1 ? "bg-sky-400" : "bg-amber-400"}`} />
                    <p className="truncate text-[11.5px] text-brand-100/90">{row}</p>
                  </div>
                )
              )}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-brand-200/60">
              Aucune donnée fictive n'est affichée dans la plateforme : cet aperçu illustre l'interface,
              vos espaces réels démarrent vides puis se remplissent de vos données.
            </p>
          </div>
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-6xl px-5 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">Douze modules, une seule plateforme</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
            Chaque module est connecté à la base de données de votre entreprise : les contenus créés,
            programmés, validés et publiés sont réellement enregistrés et exploitables.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => (
            <div key={module.title} className="card card-pad transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={module.icon} className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-3 text-[14px] font-semibold text-ink-900">{module.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{module.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="plateforme" className="bg-ink-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">Conçue pour les professionnels</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
              WebApp indépendante, accessible depuis tous les navigateurs modernes, responsive sur ordinateur,
              tablette et smartphone. Les traitements sensibles sont exécutés côté serveur.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                ["globe", "100 % en ligne", "Aucune dépendance à un mode hors ligne : vos données restent centralisées."],
                ["building", "Multi-entreprise", "Chaque client dispose de son espace isolé, de ses quotas et de ses connexions."],
                ["bot", "IA multi-fournisseurs", "OpenAI, Claude, Gemini, Mistral ou une passerelle compatible, configurable par entreprise."],
                ["layers", "Vitrine publique", "Un catalogue public personnalisable pour présenter produits et services."],
              ].map(([icon, title, text]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-700 shadow-sm">
                    <Icon name={icon} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink-900">{title}</p>
                    <p className="text-[12.5px] leading-relaxed text-ink-500">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div id="securite" className="card card-pad">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icon name="shield" className="h-4.5 w-4.5" />
              </span>
              <h3 className="text-[15px] font-semibold text-ink-900">Sécurité et protection des données</h3>
            </div>
            <ul className="mt-4 space-y-2.5">
              {SECURITY.map((item) => (
                <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-600">
                  <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-500">
              Une intégration externe (réseau social, fournisseur IA) ne fonctionne que lorsqu'une
              autorisation officielle est configurée. Les modules concernés indiquent clairement ce qui reste à configurer.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-brand-900 py-14 text-white">
        <div className="grid-lines absolute inset-0 opacity-40" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Prêt à structurer votre communication ?</h2>
            <p className="mt-2 max-w-xl text-[13.5px] text-brand-100/80">
              Créez l'espace de votre entreprise, invitez votre équipe et commencez à produire vos contenus.
            </p>
          </div>
          <Link href="/register" className="btn btn-accent">
            Créer mon espace <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark.png" alt="SHALO COM SPACE" className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <p className="text-[12.5px] font-semibold text-ink-900">SHALO COM SPACE</p>
              <p className="text-[11px] text-ink-500">Édité par BATIANA TECH</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-ink-500">
            <Link href="/login" className="hover:text-brand-700">Connexion</Link>
            <Link href="/register" className="hover:text-brand-700">Inscription</Link>
            <Link href="/setup" className="hover:text-brand-700">Installation plateforme</Link>
            <span>© {new Date().getFullYear()} BATIANA TECH</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
