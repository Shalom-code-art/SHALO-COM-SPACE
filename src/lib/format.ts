/** Utilitaires d'affichage et libelles metier partages par l'interface. */

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function formatMoney(cents: number, currency = "XAF"): string {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XAF" ? 0 : 2,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR").format(Number(value ?? 0));
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, true);
}

export function formatDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "à l'instant";
  if (Math.abs(minutes) < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `il y a ${days} j`;
  return formatDate(value);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Statuts de contenus (Module 03/04). */
export const CONTENT_STATUSES = {
  draft: "Brouillon",
  in_progress: "En préparation",
  in_review: "En validation",
  approved: "Approuvé",
  scheduled: "Programmé",
  published: "Publié",
  cancelled: "Annulé",
} as const;
export type ContentStatus = keyof typeof CONTENT_STATUSES;

export const CONTENT_TYPES = {
  post: "Publication",
  ad_poster: "Affiche promotionnelle",
  announcement: "Annonce",
  ad_text: "Texte publicitaire",
  article: "Article",
  commercial_description: "Description commerciale",
  video_script: "Script vidéo",
  audio_script: "Script audio",
  sales_message: "Message commercial",
  product_presentation: "Présentation de produit",
} as const;
export type ContentType = keyof typeof CONTENT_TYPES;

export const EDITORIAL_TONES = {
  commercial: "Commercial",
  institutional: "Institutionnel",
  professional: "Professionnel",
  promotional: "Promotionnel",
  informative: "Informatif",
  educational: "Éducatif",
  creative: "Créatif",
} as const;

export const CAMPAIGN_STATUSES = {
  planned: "Planifiée",
  active: "En cours",
  paused: "En pause",
  completed: "Terminée",
  cancelled: "Annulée",
} as const;

export const CAMPAIGN_TYPES = {
  promotion: "Promotion commerciale",
  product_launch: "Lancement de produit",
  institutional: "Communication institutionnelle",
  acquisition: "Acquisition de clients",
  retention: "Fidélisation",
  awareness: "Sensibilisation",
  event: "Événementiel",
} as const;

export const PLATFORMS = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp Business",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Autre plateforme",
} as const;
export type PlatformId = keyof typeof PLATFORMS;

export const SOCIAL_STATUSES = {
  connected: "Connecté",
  pending: "Autorisation en attente",
  disconnected: "Déconnecté",
  not_configured: "Configuration requise",
} as const;

export const PRODUCT_AVAILABILITY = {
  in_stock: "Disponible",
  out_of_stock: "Rupture de stock",
  preorder: "Précommande",
  unavailable: "Indisponible",
} as const;

export const TASK_STATUSES = {
  todo: "À faire",
  in_progress: "En cours",
  blocked: "Bloquée",
  done: "Terminée",
} as const;

export const AI_KINDS = {
  facebook_post: "Publication Facebook",
  instagram_post: "Publication Instagram",
  linkedin_post: "Contenu LinkedIn",
  whatsapp_message: "Message WhatsApp",
  ad_text: "Texte publicitaire",
  product_description: "Description de produit",
  slogan: "Slogan",
  campaign_ideas: "Propositions de campagne",
  rewrite: "Correction / reformulation",
  translate: "Traduction",
  editorial_calendar: "Calendrier éditorial",
  marketing_strategy: "Stratégie marketing",
  general: "Demande libre",
} as const;
export type AiKind = keyof typeof AI_KINDS;

export const AI_LANGUAGES = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  pt: "Portugais",
  ar: "Arabe",
} as const;

/** Couleurs de badge par statut (classes Tailwind). */
export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    in_review: "bg-violet-50 text-violet-700 border-violet-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    scheduled: "bg-sky-50 text-sky-700 border-sky-200",
    published: "bg-brand-50 text-brand-700 border-brand-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
    planned: "bg-slate-100 text-slate-700 border-slate-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-brand-50 text-brand-700 border-brand-200",
    connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    disconnected: "bg-rose-50 text-rose-700 border-rose-200",
    not_configured: "bg-slate-100 text-slate-600 border-slate-200",
    in_stock: "bg-emerald-50 text-emerald-700 border-emerald-200",
    out_of_stock: "bg-rose-50 text-rose-700 border-rose-200",
    preorder: "bg-sky-50 text-sky-700 border-sky-200",
    unavailable: "bg-slate-100 text-slate-600 border-slate-200",
    todo: "bg-slate-100 text-slate-700 border-slate-200",
    blocked: "bg-rose-50 text-rose-700 border-rose-200",
    done: "bg-emerald-50 text-emerald-700 border-emerald-200",
    admin: "bg-brand-900 text-white border-brand-900",
  };
  return map[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

export function labelOf<T extends Record<string, string>>(dictionary: T, key: string | null | undefined): string {
  if (!key) return "—";
  return (dictionary as Record<string, string>)[key] ?? key;
}
