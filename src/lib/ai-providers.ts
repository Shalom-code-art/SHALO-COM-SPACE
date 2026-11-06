/**
 * Passerelle multi-fournisseurs pour le Centre IA.
 *
 * Chaque fournisseur utilise son API officielle et documentee. Aucun appel
 * n'est simule : si la cle n'est pas configuree, aucune reponse n'est inventee.
 * L'architecture permet d'ajouter SHALORAH LLM (protocole compatible OpenAI).
 */

export type AiProviderId = "openai" | "anthropic" | "google" | "mistral" | "shalorah" | "custom";

export type AiProviderMeta = {
  id: AiProviderId;
  label: string;
  protocol: "openai" | "anthropic" | "google";
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  status: "available" | "planned";
  docsUrl: string;
  note: string;
};

export const AI_PROVIDERS: Record<AiProviderId, AiProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    requiresKey: true,
    status: "available",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    note: "API Chat Completions officielle. Cle a creer sur platform.openai.com.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5",
    requiresKey: true,
    status: "available",
    docsUrl: "https://docs.anthropic.com/en/api/messages",
    note: "API Messages officielle.",
  },
  google: {
    id: "google",
    label: "Google Gemini",
    protocol: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    requiresKey: true,
    status: "available",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    note: "API Generative Language officielle.",
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    protocol: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    requiresKey: true,
    status: "available",
    docsUrl: "https://docs.mistral.ai/api/",
    note: "API compatible OpenAI.",
  },
  shalorah: {
    id: "shalorah",
    label: "SHALORAH LLM",
    protocol: "openai",
    baseUrl: "",
    defaultModel: "shalorah-1",
    requiresKey: true,
    status: "planned",
    docsUrl: "",
    note: "Moteur IA BATIANA TECH en cours de developpement : integrable des la mise a disposition d'une URL et d'une cle.",
  },
  custom: {
    id: "custom",
    label: "Fournisseur compatible OpenAI",
    protocol: "openai",
    baseUrl: "",
    defaultModel: "",
    requiresKey: true,
    status: "available",
    docsUrl: "",
    note: "Renseignez l'URL de base et le modele de votre passerelle compatible OpenAI.",
  },
};

export type ProviderCallConfig = {
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  temperature: number;
  apiKey: string | null;
};

const TIMEOUT_MS = 90_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      const providerMessage =
        (parsed as { error?: { message?: string } })?.error?.message ??
        (typeof parsed === "object" && parsed && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : raw.slice(0, 300));
      throw new Error(`Fournisseur IA (${response.status}) : ${providerMessage || "requete refusee"}`);
    }
    return parsed as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

/** Envoie la requete au fournisseur configure et retourne le texte genere. */
export async function callProvider(
  config: ProviderCallConfig,
  input: { system: string; prompt: string; maxTokens?: number }
): Promise<string> {
  const meta = AI_PROVIDERS[config.provider];
  if (!meta) throw new Error("Fournisseur IA inconnu.");
  if (!config.apiKey) throw new Error("AI_NOT_CONFIGURED");
  const base = (config.baseUrl || meta.baseUrl).replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "URL de base du fournisseur manquante. Renseignez-la dans Parametres > Intelligence artificielle."
    );
  }
  const maxTokens = input.maxTokens ?? 1200;

  if (meta.protocol === "anthropic") {
    const data = await postJson(
      `${base}/messages`,
      { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
      {
        model: config.model,
        max_tokens: maxTokens,
        temperature: config.temperature,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      }
    );
    const blocks = (data.content as { type: string; text?: string }[] | undefined) ?? [];
    const text = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();
    if (!text) throw new Error("Reponse vide du fournisseur IA.");
    return text;
  }

  if (meta.protocol === "google") {
    const data = await postJson(
      `${base}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {},
      {
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: { temperature: config.temperature, maxOutputTokens: maxTokens },
      }
    );
    const candidates = (data.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined) ?? [];
    const text = candidates
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    if (!text) throw new Error("Reponse vide du fournisseur IA.");
    return text;
  }

  const data = await postJson(
    `${base}/chat/completions`,
    { authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      temperature: config.temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
    }
  );
  const choices = (data.choices as { message?: { content?: string } }[] | undefined) ?? [];
  const text = (choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Reponse vide du fournisseur IA.");
  return text;
}
