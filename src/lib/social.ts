/**
 * Capacites reseaux sociaux (Module 05).
 *
 * SHALO COM SPACE n'active une publication automatique que lorsqu'une
 * integration officielle est reellement configuree (identifiants d'application
 * et autorisations de l'entreprise). Sans cela, la procedure manuelle reste la
 * seule option : aucun envoi n'est simule.
 */

export type SocialPlatformId = "facebook" | "instagram" | "whatsapp" | "linkedin" | "tiktok" | "youtube";

export type SocialPlatform = {
  label: string;
  env: string[];
  scopes: string[];
  docs: string;
  api: string;
  manualSteps: string[];
};

export const SOCIAL_PLATFORMS: Record<SocialPlatformId, SocialPlatform> = {
  facebook: {
    label: "Facebook",
    env: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "FACEBOOK_PAGE_ACCESS_TOKEN"],
    scopes: ["pages_manage_posts", "pages_read_engagement"],
    docs: "https://developers.facebook.com/docs/pages-api",
    api: "Graph API — publication sur une Page",
    manualSteps: [
      "Exporter le visuel et le texte depuis le studio de contenu.",
      "Publier depuis la Page Facebook officielle de l'entreprise.",
      "Revenir dans SHALO COM SPACE et déclarer la publication comme effectuée.",
    ],
  },
  instagram: {
    label: "Instagram",
    env: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
    scopes: ["instagram_basic", "instagram_content_publish"],
    docs: "https://developers.facebook.com/docs/instagram-platform",
    api: "Instagram Graph API — compte professionnel",
    manualSteps: [
      "Télécharger le visuel depuis la médiathèque.",
      "Publier depuis l'application Instagram (compte professionnel).",
      "Déclarer la publication dans le calendrier éditorial.",
    ],
  },
  whatsapp: {
    label: "WhatsApp Business",
    env: ["WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    scopes: ["whatsapp_business_messaging"],
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    api: "WhatsApp Cloud API — messages modèles approuvés",
    manualSteps: [
      "Copier le message validé depuis le studio.",
      "Envoyer depuis WhatsApp Business (numéro officiel de l'entreprise).",
      "Noter l'échange dans la fiche contact concernée.",
    ],
  },
  linkedin: {
    label: "LinkedIn",
    env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ORGANIZATION_ID"],
    scopes: ["w_organization_social", "r_organization_social"],
    docs: "https://learn.microsoft.com/linkedin/marketing/",
    api: "LinkedIn Marketing API — Page entreprise",
    manualSteps: [
      "Copier le texte professionnel généré par le studio.",
      "Publier depuis la Page LinkedIn de l'entreprise.",
      "Marquer la publication comme effectuée.",
    ],
  },
  tiktok: {
    label: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    scopes: ["video.publish", "video.upload"],
    docs: "https://developers.tiktok.com/doc/content-posting-api-get-started",
    api: "TikTok Content Posting API — compte professionnel",
    manualSteps: [
      "Exporter la vidéo et le script depuis la médiathèque.",
      "Publier depuis TikTok sur le compte officiel.",
      "Déclarer la publication et ses statistiques réelles.",
    ],
  },
  youtube: {
    label: "YouTube",
    env: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
    scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    docs: "https://developers.google.com/youtube/v3/guides/uploading_a_video",
    api: "YouTube Data API v3 — envoi de vidéo",
    manualSteps: [
      "Exporter la vidéo et sa description depuis le studio.",
      "Envoyer la vidéo depuis YouTube Studio.",
      "Reporter l'URL et les statistiques réelles dans la fiche contenu.",
    ],
  },
};

export function missingEnv(platform: string): string[] {
  const meta = SOCIAL_PLATFORMS[platform as SocialPlatformId];
  if (!meta) return [];
  return meta.env.filter((key) => !process.env[key]);
}

/** Une publication automatique n'est possible que si l'application officielle est configurée. */
export function isPlatformConfigured(platform: string): boolean {
  return missingEnv(platform).length === 0;
}

export function configuredPlatforms(): SocialPlatformId[] {
  return (Object.keys(SOCIAL_PLATFORMS) as SocialPlatformId[]).filter((platform) => isPlatformConfigured(platform));
}
