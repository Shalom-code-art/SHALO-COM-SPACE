import { AI_KINDS, type AiKind } from "@/lib/format";

/** Construction des invites envoyees aux fournisseurs IA (Centre IA, Module 02). */

const PLATFORM_RULES: Record<string, string> = {
  facebook: "Publication Facebook : accroche courte, 80 a 200 mots, emojis discrets, 1 a 3 hashtags pertinents.",
  instagram: "Publication Instagram : premiere ligne forte, texte aere, 5 a 10 hashtags pertinents, maximum 2200 caracteres.",
  linkedin: "Publication LinkedIn : ton professionnel, structure claire, pas d'emojis excessifs, 600 a 1200 caracteres.",
  whatsapp:
    "Message WhatsApp Business : court, direct, poli, sans spam, avec une seule proposition d'action. Rappeler que le destinataire doit avoir donne son consentement.",
  tiktok: "Script TikTok : hook de 3 secondes, deroule visuel, appel a l'action.",
  youtube: "Script YouTube : accroche, plan detaille, appel a l'abonnement.",
};

const KIND_INSTRUCTIONS: Record<AiKind, string> = {
  facebook_post: "Redige une publication Facebook prete a publier.",
  instagram_post: "Redige une legende Instagram prete a publier.",
  linkedin_post: "Redige un post LinkedIn professionnel.",
  whatsapp_message: "Redige un message WhatsApp Business pret a envoyer.",
  ad_text: "Redige un texte publicitaire structure avec accroche, arguments et appel a l'action.",
  product_description: "Redige une description commerciale de produit ou service : benefices, caracteristiques, appel a l'action.",
  slogan: "Propose 10 slogans courts, memorisables et differenciants.",
  campaign_ideas: "Propose 3 idees de campagne completes : concept, cibles, canaux, message cle, indicateurs de succes.",
  rewrite: "Corrige et reformule le texte source en conservant le sens, en ameliorant la clarte et la fluidite.",
  translate: "Traduis le texte source dans la langue demandee en conservant le ton et le niveau de langage.",
  editorial_calendar:
    "Construis un calendrier editorial sous forme de tableau texte (Date | Type de contenu | Plateforme | Idee | Objectif), sur la periode demandee.",
  marketing_strategy:
    "Propose une strategie marketing structuree : objectifs, cibles, positionnement, canaux, plan d'action par semaine, budget indicatif, indicateurs.",
  general: "Reponds de facon utile et professionnelle a la demande.",
};

export type PromptRequest = {
  kind: string;
  platform?: string;
  tone: string;
  language: string;
  brief: string;
  businessContext?: string;
  audience?: string;
  keywords?: string;
  sourceText?: string;
};

export function buildPrompts(
  request: PromptRequest,
  company: { name: string; city?: string | null; country?: string | null; shopTagline?: string | null }
) {
  const kindLabel = AI_KINDS[request.kind as AiKind] ?? request.kind;
  const system = [
    "Tu es l'assistant de communication de SHALO COM SPACE, plateforme de communication digitale et de marketing intelligent editee par BATIANA TECH.",
    "Tu produis des contenus professionnels, prets a etre utilises, en francais par defaut.",
    "Contraintes absolues : ne jamais inventer de chiffres, de prix, de partenaires ou de promesses ; rester conforme aux regles anti-spam et de consentement ; ne pas promettre de resultats garantis.",
    "Reponds uniquement avec le contenu final, sans commentaire meta ni explication du processus.",
  ].join("\n");

  const lines: string[] = [];
  lines.push(`Entreprise : ${company.name}`);
  if (company.city || company.country) lines.push(`Localisation : ${[company.city, company.country].filter(Boolean).join(", ")}`);
  if (company.shopTagline) lines.push(`Positionnement declare : ${company.shopTagline}`);
  lines.push(`Livrable demande : ${kindLabel}.`);
  lines.push(`Instruction : ${KIND_INSTRUCTIONS[request.kind as AiKind] ?? KIND_INSTRUCTIONS.general}`);
  if (request.platform && PLATFORM_RULES[request.platform]) {
    lines.push(`Contraintes de plateforme : ${PLATFORM_RULES[request.platform]}`);
  }
  lines.push(`Ton redactionnel : ${request.tone}.`);
  lines.push(`Langue de sortie : ${request.language}.`);
  lines.push(`Brief du client : ${request.brief}`);
  if (request.audience) lines.push(`Public cible : ${request.audience}`);
  if (request.keywords) lines.push(`Mots-cles a integrer naturellement : ${request.keywords}`);
  if (request.businessContext) lines.push(`Contexte de l'entreprise : ${request.businessContext}`);
  if (request.sourceText) lines.push(`Texte source a traiter :\n"""${request.sourceText}"""`);

  return { system, prompt: lines.join("\n") };
}
