"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requireUser, revokeAllSessions } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { get, newId, nowIso, run } from "@/lib/db";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import { companyProfileSchema, zodMessage } from "@/lib/validation";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/ai-providers";
import { setSettings, storeAiKey } from "@/lib/settings";

function enc(value: string) {
  return encodeURIComponent(value);
}

function settingsUrl(section: string, extra = "") {
  return `/app/settings?section=${section}${extra ? `&${extra}` : ""}`;
}

/* ------------------------------------------------------------------ */
/* Entreprise                                                          */
/* ------------------------------------------------------------------ */

export async function saveCompanyProfileAction(formData: FormData) {
  const user = await requireUser("settings.manage");
  const companyId = user.companyId!;
  const parsed = companyProfileSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    country: formData.get("country") ?? "",
    website: formData.get("website") ?? "",
    primaryColor: formData.get("primaryColor") ?? "#0f2c52",
    secondaryColor: formData.get("secondaryColor") ?? "#f97316",
    shopEnabled: formData.get("shopEnabled") === "on",
    shopTagline: formData.get("shopTagline") ?? "",
    shopAbout: formData.get("shopAbout") ?? "",
  });
  if (!parsed.success) redirect(settingsUrl("company", `error=${enc(zodMessage(parsed.error))}`));
  const data = parsed.data;

  const company = get<{ slug: string }>("SELECT slug FROM companies WHERE id = ?", [companyId]);
  if (!company) redirect("/login");

  run(
    `UPDATE companies SET name = ?, legal_name = ?, email = ?, phone = ?, address = ?, city = ?, country = ?,
       website = ?, primary_color = ?, secondary_color = ?, shop_enabled = ?, shop_tagline = ?, shop_about = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.name,
      data.legalName || null,
      data.email || null,
      data.phone || null,
      data.address || null,
      data.city || null,
      data.country || null,
      data.website || null,
      data.primaryColor,
      data.secondaryColor,
      data.shopEnabled ? 1 : 0,
      data.shopTagline || null,
      data.shopAbout || null,
      nowIso(),
      companyId,
    ]
  );

  const logoMediaId = String(formData.get("logoMediaId") ?? "");
  if (logoMediaId) {
    const media = get<{ id: string }>("SELECT id FROM media WHERE id = ? AND company_id = ? AND kind = 'image'", [
      logoMediaId,
      companyId,
    ]);
    if (media) {
      run("UPDATE companies SET logo_url = ? WHERE id = ?", [`/api/shop/${company.slug}/media/${logoMediaId}`, companyId]);
      setSettings(companyId, { "brand.logo_media_id": logoMediaId });
    }
  } else if (formData.get("removeLogo") === "1") {
    run("UPDATE companies SET logo_url = NULL WHERE id = ?", [companyId]);
    setSettings(companyId, { "brand.logo_media_id": "" });
  }

  logAudit({ companyId, actor: user, action: "settings.company_updated", entity: "company", entityId: companyId, ip: await clientIp() });
  revalidatePath("/app/settings");
  revalidatePath("/app");
  redirect(settingsUrl("company", `saved=${enc("Informations de l'entreprise enregistrées")}`));
}

/* ------------------------------------------------------------------ */
/* Intelligence artificielle                                           */
/* ------------------------------------------------------------------ */

export async function saveAiSettingsAction(formData: FormData) {
  const user = await requireUser("settings.manage");
  const companyId = user.companyId!;
  const provider = String(formData.get("provider") ?? "openai") as AiProviderId;
  if (!(provider in AI_PROVIDERS)) redirect(settingsUrl("ai", `error=${enc("Fournisseur inconnu.")}`));
  const model = String(formData.get("model") ?? "").trim() || AI_PROVIDERS[provider].defaultModel;
  const baseUrl = String(formData.get("baseUrl") ?? "").trim() || AI_PROVIDERS[provider].baseUrl;
  const temperature = Math.min(1.5, Math.max(0, Number(formData.get("temperature") ?? 0.7)));

  if (!/^https?:\/\//.test(baseUrl)) {
    redirect(settingsUrl("ai", `error=${enc("L'adresse du fournisseur doit commencer par http(s)://")}`));
  }

  setSettings(companyId, {
    "ai.provider": provider,
    "ai.model": model,
    "ai.base_url": baseUrl,
    "ai.temperature": String(Number.isFinite(temperature) ? temperature : 0.7),
  });

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (formData.get("clearKey") === "1") {
    storeAiKey(companyId, "");
  } else if (apiKey) {
    if (apiKey.length < 12) redirect(settingsUrl("ai", `error=${enc("Clé API trop courte.")}`));
    storeAiKey(companyId, apiKey);
  }

  logAudit({ companyId, actor: user, action: "settings.ai_updated", entity: "company", entityId: companyId, details: provider, ip: await clientIp() });
  revalidatePath("/app/settings");
  redirect(settingsUrl("ai", `saved=${enc("Paramètres IA enregistrés")}`));
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

const NOTIFICATION_KEYS = ["content", "campaign", "team", "social", "alert"] as const;

export async function saveNotificationPreferencesAction(formData: FormData) {
  const user = await requireUser("settings.manage");
  const companyId = user.companyId!;
  const values: Record<string, string> = {};
  for (const key of NOTIFICATION_KEYS) {
    values[`notifications.${key}`] = formData.get(`notify_${key}`) === "on" ? "on" : "off";
  }
  setSettings(companyId, values);
  logAudit({ companyId, actor: user, action: "settings.notifications_updated", entity: "company", entityId: companyId, ip: await clientIp() });
  revalidatePath("/app/settings");
  redirect(settingsUrl("notifications", `saved=${enc("Préférences de notification enregistrées")}`));
}

/* ------------------------------------------------------------------ */
/* Securite                                                            */
/* ------------------------------------------------------------------ */

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) redirect(settingsUrl("security", `error=${enc("Le nouveau mot de passe doit contenir au moins 8 caractères.")}`));
  if (next !== confirm) redirect(settingsUrl("security", `error=${enc("La confirmation ne correspond pas.")}`));

  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  if (!row || !verifyPassword(current, row.password_hash)) {
    redirect(settingsUrl("security", `error=${enc("Mot de passe actuel incorrect.")}`));
  }
  run("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?", [
    hashPassword(next),
    nowIso(),
    user.id,
  ]);
  logAudit({ companyId: user.companyId, actor: user, action: "user.password_changed", entity: "user", entityId: user.id, ip: await clientIp() });
  revalidatePath("/app/settings");
  redirect(settingsUrl("security", `saved=${enc("Mot de passe mis à jour")}`));
}

export async function revokeOtherSessionsAction() {
  const user = await requireUser();
  revokeAllSessions(user.id);
  logAudit({ companyId: user.companyId, actor: user, action: "user.sessions_revoked", entity: "user", entityId: user.id, ip: await clientIp() });
  redirect("/login?error=Sessions révoquées, veuillez vous reconnecter.");
}

/* ------------------------------------------------------------------ */
/* Cles API                                                            */
/* ------------------------------------------------------------------ */

export async function createApiKeyAction(formData: FormData) {
  const user = await requireUser("apikeys.manage");
  const companyId = user.companyId!;
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) redirect(settingsUrl("api", `error=${enc("Donnez un nom à la clé.")}`));
  const secret = `shalo_${randomToken(24)}`;
  const prefix = secret.slice(0, 12);
  const id = newId();
  run("INSERT INTO api_keys (id, company_id, name, prefix, key_hash, created_by, created_at) VALUES (?,?,?,?,?,?,?)", [
    id,
    companyId,
    name,
    prefix,
    sha256(secret),
    user.id,
    nowIso(),
  ]);
  logAudit({ companyId, actor: user, action: "apikey.created", entity: "api_key", entityId: id, details: name, ip: await clientIp() });
  revalidatePath("/app/settings");
  redirect(settingsUrl("api", `created=${enc(secret)}&saved=${enc("Clé API créée")}`));
}

export async function revokeApiKeyAction(formData: FormData) {
  const user = await requireUser("apikeys.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const key = get<{ name: string }>("SELECT name FROM api_keys WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!key) redirect(settingsUrl("api", `error=${enc("Clé introuvable.")}`));
  run("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND company_id = ?", [nowIso(), id, companyId]);
  logAudit({ companyId, actor: user, action: "apikey.revoked", entity: "api_key", entityId: id, details: key.name, ip: await clientIp() });
  revalidatePath("/app/settings");
  redirect(settingsUrl("api", `saved=${enc("Clé API révoquée")}`));
}

/* ------------------------------------------------------------------ */
/* Donnees                                                             */
/* ------------------------------------------------------------------ */

/** Enregistre une demande de suppression de compte : elle est traitee par BATIANA TECH. */
export async function requestDataDeletionAction(formData: FormData) {
  const user = await requireUser("settings.manage");
  const companyId = user.companyId!;
  const confirmation = String(formData.get("confirm") ?? "").trim();
  if (confirmation !== "SUPPRIMER") {
    redirect(settingsUrl("data", `error=${enc("Saisissez SUPPRIMER pour confirmer la demande.")}`));
  }
  const requestId = newId();
  run("INSERT INTO notifications (id, company_id, user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?,?)", [
    requestId,
    companyId,
    null,
    "alert",
    "Demande de suppression de compte",
    `${user.name} (${user.email}) demande la suppression des données de l'entreprise.`,
    "/admin/companies",
    nowIso(),
  ]);
  logAudit({
    companyId,
    actor: user,
    action: "company.deletion_requested",
    entity: "company",
    entityId: companyId,
    details: "Demande enregistrée, traitement BATIANA TECH requis",
    ip: await clientIp(),
  });
  notify({
    companyId,
    type: "alert",
    title: "Demande enregistrée",
    body: "BATIANA TECH traitera la suppression après vérification.",
    link: "/app/settings?section=data",
    userId: user.id,
  });
  revalidatePath("/app/settings");
  redirect(settingsUrl("data", `saved=${enc("Demande de suppression enregistrée. BATIANA TECH vous contactera pour confirmation.")}`));
}
