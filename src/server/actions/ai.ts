"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { get, newId, nowIso, run } from "@/lib/db";
import { aiRequestSchema, zodMessage } from "@/lib/validation";
import { buildPrompts } from "@/lib/ai-prompts";
import { resolveAiConfig, runAi } from "@/lib/settings";

function enc(value: string) {
  return encodeURIComponent(value);
}

/** Correspondance entre un livrable IA et un type de contenu du Studio. */
const KIND_TO_CONTENT_TYPE: Record<string, string> = {
  facebook_post: "post",
  instagram_post: "post",
  linkedin_post: "post",
  whatsapp_message: "sales_message",
  ad_text: "ad_text",
  product_description: "commercial_description",
  slogan: "announcement",
  campaign_ideas: "article",
  rewrite: "post",
  translate: "post",
  editorial_calendar: "article",
  marketing_strategy: "article",
  general: "article",
};

function aiUrl(extra = "") {
  return `/app/ai${extra ? `?${extra}` : ""}`;
}

function titleFromBrief(brief: string): string {
  const cleaned = brief.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Contenu généré par l'IA";
  return cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned;
}

export async function generateAiAction(formData: FormData) {
  const user = await requireUser("ai.use");
  const companyId = user.companyId!;

  const parsed = aiRequestSchema.safeParse({
    kind: formData.get("kind"),
    platform: formData.get("platform") ?? "",
    tone: formData.get("tone") ?? "professionnel",
    language: formData.get("language") ?? "fr",
    brief: formData.get("brief") ?? "",
    businessContext: formData.get("businessContext") ?? "",
    audience: formData.get("audience") ?? "",
    keywords: formData.get("keywords") ?? "",
    sourceText: formData.get("sourceText") ?? "",
  });
  if (!parsed.success) redirect(aiUrl(`error=${enc(zodMessage(parsed.error))}`));
  const data = parsed.data;

  const config = resolveAiConfig(companyId);
  if (!config.configured) {
    redirect(
      aiUrl(
        `error=${enc(
          "Aucune clé API n'est configurée : le Centre IA ne génère rien. Renseignez une clé dans Paramètres > Intelligence artificielle."
        )}`
      )
    );
  }

  const company = get<{ name: string; city: string | null; country: string | null; shop_tagline: string | null }>(
    "SELECT name, city, country, shop_tagline FROM companies WHERE id = ?",
    [companyId]
  );
  if (!company) redirect("/login");

  const prompts = buildPrompts(
    {
      kind: data.kind,
      platform: data.platform || undefined,
      tone: data.tone,
      language: data.language,
      brief: data.brief,
      businessContext: data.businessContext || undefined,
      audience: data.audience || undefined,
      keywords: data.keywords || undefined,
      sourceText: data.sourceText || undefined,
    },
    { name: company.name, city: company.city, country: company.country, shopTagline: company.shop_tagline }
  );

  let generationId = "";
  let failure = "";
  try {
    const result = await runAi(config, { system: prompts.system, prompt: prompts.prompt });
    generationId = newId();
    run(
      `INSERT INTO ai_generations (id, company_id, user_id, kind, platform, tone, language, prompt, output, provider, model, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        generationId,
        companyId,
        user.id,
        data.kind,
        data.platform || null,
        data.tone,
        data.language,
        data.brief,
        result.text,
        result.provider,
        result.model,
        nowIso(),
      ]
    );
    logAudit({
      companyId,
      actor: user,
      action: "ai.generated",
      entity: "ai_generation",
      entityId: generationId,
      details: `${data.kind} · ${result.provider}/${result.model}`,
      ip: await clientIp(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue du fournisseur IA.";
    failure =
      message === "AI_NOT_CONFIGURED"
        ? "Le fournisseur IA n'est pas configuré : aucune génération n'a été effectuée."
        : message;
  }

  if (failure) redirect(aiUrl(`error=${enc(failure)}`));

  revalidatePath("/app/ai");
  redirect(aiUrl(`generation=${generationId}&saved=${enc("Contenu généré par l'IA")}`));
}

/** Transforme une génération en contenu éditable du Studio (Module 03). */
export async function convertGenerationAction(formData: FormData) {
  const user = await requireUser("content.create");
  const companyId = user.companyId!;
  const generationId = String(formData.get("id") ?? "");

  const generation = get<{
    id: string;
    kind: string;
    output: string | null;
    tone: string | null;
    language: string | null;
    prompt: string | null;
    content_id: string | null;
  }>("SELECT id, kind, output, tone, language, prompt, content_id FROM ai_generations WHERE id = ? AND company_id = ?", [
    generationId,
    companyId,
  ]);
  if (!generation || !generation.output) {
    redirect(aiUrl(`error=${enc("Génération introuvable ou vide.")}`));
  }
  if (generation.content_id) {
    redirect(`/app/content/${generation.content_id}`);
  }

  const contentId = newId();
  const ts = nowIso();
  run(
    `INSERT INTO contents (id, company_id, type, title, body, tone, language, status, author_id, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      contentId,
      companyId,
      KIND_TO_CONTENT_TYPE[generation.kind] ?? "post",
      titleFromBrief(generation.prompt ?? ""),
      generation.output,
      generation.tone,
      generation.language ?? "fr",
      "draft",
      user.id,
      "ai",
      ts,
      ts,
    ]
  );
  run("UPDATE ai_generations SET content_id = ? WHERE id = ? AND company_id = ?", [contentId, generationId, companyId]);
  logAudit({
    companyId,
    actor: user,
    action: "ai.converted_to_content",
    entity: "content",
    entityId: contentId,
    details: `Depuis la génération ${generationId}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/content");
  revalidatePath("/app/ai");
  redirect(`/app/content/${contentId}?saved=${enc("Contenu créé depuis le Centre IA")}`);
}

export async function deleteGenerationAction(formData: FormData) {
  const user = await requireUser("ai.use");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const generation = get<{ id: string }>("SELECT id FROM ai_generations WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!generation) redirect(aiUrl(`error=${enc("Génération introuvable.")}`));
  run("DELETE FROM ai_generations WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({
    companyId,
    actor: user,
    action: "ai.generation_deleted",
    entity: "ai_generation",
    entityId: id,
    ip: await clientIp(),
  });
  revalidatePath("/app/ai");
  redirect(aiUrl(`saved=${enc("Génération supprimée")}`));
}
