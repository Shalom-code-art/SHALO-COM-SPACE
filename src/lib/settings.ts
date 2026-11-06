import { all, run } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { AI_PROVIDERS, type AiProviderId, callProvider } from "@/lib/ai-providers";

/** Parametres d'entreprise (table company_settings). */

export function getSettings(companyId: string): Record<string, string> {
  const rows = all<{ key: string; value: string }>(
    "SELECT key, value FROM company_settings WHERE company_id = ?",
    [companyId]
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value ?? ""]));
}

export function getSetting(companyId: string, key: string, fallback = ""): string {
  const rows = all<{ value: string }>(
    "SELECT value FROM company_settings WHERE company_id = ? AND key = ?",
    [companyId, key]
  );
  return rows[0]?.value ?? fallback;
}

export function setSettings(companyId: string, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    run(
      `INSERT INTO company_settings (company_id, key, value) VALUES (?,?,?)
       ON CONFLICT(company_id, key) DO UPDATE SET value = excluded.value`,
      [companyId, key, value]
    );
  }
}

export function storeAiKey(companyId: string, apiKey: string) {
  if (!apiKey) {
    run("DELETE FROM company_settings WHERE company_id = ? AND key = ?", [companyId, "ai.api_key"]);
    return;
  }
  setSettings(companyId, { "ai.api_key": encryptSecret(apiKey) });
}

export type ResolvedAiConfig = {
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  temperature: number;
  apiKey: string | null;
  keySource: "company" | "environment" | "none";
  configured: boolean;
};

/**
 * Resout la configuration IA d'une entreprise.
 * Une cle saisie par l'entreprise est prioritaire ; sinon la cle d'environnement
 * de l'editeur est utilisee (si presente). La cle n'est jamais renvoyee au client.
 */
export function resolveAiConfig(companyId: string): ResolvedAiConfig {
  const settings = getSettings(companyId);
  const provider = (settings["ai.provider"] || "openai") as AiProviderId;
  const meta = AI_PROVIDERS[provider] ?? AI_PROVIDERS.openai;
  const model = settings["ai.model"] || meta.defaultModel;
  const baseUrl = settings["ai.base_url"] || meta.baseUrl;
  const temperature = Number(settings["ai.temperature"] || "0.7");

  let apiKey: string | null = decryptSecret(settings["ai.api_key"]);
  let keySource: ResolvedAiConfig["keySource"] = apiKey ? "company" : "none";
  if (!apiKey) {
    const envKey =
      provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "anthropic"
          ? process.env.ANTHROPIC_API_KEY
          : provider === "google"
            ? process.env.GOOGLE_AI_API_KEY
            : provider === "shalorah"
              ? process.env.SHALORAH_API_KEY
              : undefined;
    if (envKey) {
      apiKey = envKey;
      keySource = "environment";
    }
  }
  return {
    provider,
    model,
    baseUrl,
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
    apiKey,
    keySource,
    configured: Boolean(apiKey),
  };
}

export type AiRunResult = {
  text: string;
  provider: AiProviderId;
  model: string;
};

/** Appelle reellement le fournisseur configure. Aucune reponse simulee. */
export async function runAi(
  config: ResolvedAiConfig,
  input: { system: string; prompt: string; maxTokens?: number }
): Promise<AiRunResult> {
  if (!config.configured || !config.apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  const text = await callProvider(config, input);
  return { text, provider: config.provider, model: config.model };
}
