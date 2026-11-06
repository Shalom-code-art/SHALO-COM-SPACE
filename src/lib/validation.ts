import { z } from "zod";

/** Schemas de validation partages par les actions serveur et l'API v1. */

export const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide.");
export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis."),
});

export const registerSchema = z.object({
  companyName: z.string().trim().min(2, "Nom de l'entreprise requis.").max(120),
  name: z.string().trim().min(2, "Nom du responsable requis.").max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
});

export const contentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Titre requis.").max(200),
  type: z.string().trim().min(1),
  body: z.string().max(20000).default(""),
  tone: z.string().trim().max(40).optional().or(z.literal("")),
  status: z.string().trim().min(1).default("draft"),
  campaignId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().trim().optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional().or(z.literal("")),
});

export const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Nom de campagne requis.").max(160),
  type: z.string().trim().min(1),
  objective: z.string().trim().max(300).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  audience: z.string().trim().max(500).optional().or(z.literal("")),
  startDate: z.string().trim().optional().or(z.literal("")),
  endDate: z.string().trim().optional().or(z.literal("")),
  budget: z.coerce.number().min(0).max(1_000_000_000).default(0),
  currency: z.string().trim().default("XAF"),
  channels: z.array(z.string()).default([]),
  status: z.string().trim().default("planned"),
  ownerId: z.string().uuid().nullable().optional(),
  kpiTarget: z.coerce.number().min(0).default(0),
  resultsNotes: z.string().trim().max(5000).optional().or(z.literal("")),
});

export const clientContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Nom requis.").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(160).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional().or(z.literal("")),
  consentEmail: z.coerce.boolean().default(false),
  consentWhatsapp: z.coerce.boolean().default(false),
  consentSource: z.string().trim().max(120).optional().or(z.literal("")),
});

export const employeeContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Nom requis.").max(160),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(160).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  managerName: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["product", "service"]).default("product"),
  name: z.string().trim().min(2, "Nom requis.").max(160),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(1_000_000_000).default(0),
  currency: z.string().trim().default("XAF"),
  availability: z.string().trim().default("in_stock"),
  featured: z.coerce.boolean().default(false),
  isPublic: z.coerce.boolean().default(true),
  imageMediaId: z.string().uuid().nullable().optional(),
});

export const socialAccountSchema = z.object({
  id: z.string().uuid().optional(),
  platform: z.string().trim().min(1),
  accountName: z.string().trim().min(1, "Nom du compte requis.").max(160),
  accountRef: z.string().trim().max(160).optional().or(z.literal("")),
  status: z.string().trim().default("not_configured"),
  pageUrl: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  accessToken: z.string().trim().max(4000).optional().or(z.literal("")),
  tokenExpiresAt: z.string().trim().optional().or(z.literal("")),
});

export const taskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Intitulé requis.").max(200),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
  assigneeId: z.string().uuid().nullable().optional(),
  contentId: z.string().uuid().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  dueDate: z.string().trim().optional().or(z.literal("")),
  priority: z.string().trim().default("normal"),
  status: z.string().trim().default("todo"),
});

export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "Nom requis.").max(160),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue."),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue."),
  shopEnabled: z.coerce.boolean().default(true),
  shopTagline: z.string().trim().max(200).optional().or(z.literal("")),
  shopAbout: z.string().trim().max(3000).optional().or(z.literal("")),
});

export const aiRequestSchema = z.object({
  kind: z.string().trim().min(1),
  platform: z.string().trim().optional().or(z.literal("")),
  tone: z.string().trim().default("professionnel"),
  language: z.string().trim().default("fr"),
  brief: z.string().trim().min(3, "Décrivez votre besoin.").max(4000),
  businessContext: z.string().trim().max(2000).optional().or(z.literal("")),
  audience: z.string().trim().max(500).optional().or(z.literal("")),
  keywords: z.string().trim().max(300).optional().or(z.literal("")),
  sourceText: z.string().trim().max(6000).optional().or(z.literal("")),
});

export type AiRequestInput = z.infer<typeof aiRequestSchema>;
export type ContentInput = z.infer<typeof contentSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;

/** Convertit les erreurs zod en message lisible (premier champ en erreur). */
export function zodMessage(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? first.message : "Données invalides.";
}

/** Lit un FormData en objet simple (les cases à cocher deviennent "on"). */
export function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}
