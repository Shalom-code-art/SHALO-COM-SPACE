"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { get, newId, nowIso, run } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { SOCIAL_PLATFORMS, isPlatformConfigured, type SocialPlatformId } from "@/lib/social";

function enc(value: string) {
  return encodeURIComponent(value);
}

/**
 * Déclare un compte social pour l'entreprise.
 * Le statut « connecté » n'est accordé que si l'application officielle est
 * réellement configurée côté serveur ; sinon le compte reste « en attente ».
 */
export async function saveSocialAccountAction(formData: FormData) {
  const user = await requireUser("social.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const platform = String(formData.get("platform") ?? "");
  const accountName = String(formData.get("accountName") ?? "").trim();
  const accountRef = String(formData.get("accountRef") ?? "").trim() || null;
  const pageUrl = String(formData.get("pageUrl") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const token = String(formData.get("token") ?? "").trim();

  if (!(platform in SOCIAL_PLATFORMS)) {
    redirect(`/app/social?error=${enc("Plateforme inconnue.")}`);
  }
  if (!accountName) {
    redirect(`/app/social?error=${enc("Le nom du compte est obligatoire.")}`);
  }

  const configured = isPlatformConfigured(platform);
  const status = configured ? "connected" : "pending";
  const ciphertext = token ? encryptSecret(token) : null;

  if (id) {
    const existing = get<{ id: string }>("SELECT id FROM social_accounts WHERE id = ? AND company_id = ?", [id, companyId]);
    if (!existing) redirect(`/app/social?error=${enc("Compte introuvable.")}`);
    run(
      `UPDATE social_accounts SET platform = ?, account_name = ?, account_ref = ?, page_url = ?, notes = ?, status = ?,
         token_ciphertext = COALESCE(?, token_ciphertext), scopes = ?, last_sync_at = ?
       WHERE id = ? AND company_id = ?`,
      [
        platform,
        accountName,
        accountRef,
        pageUrl,
        notes,
        status,
        ciphertext,
        SOCIAL_PLATFORMS[platform as SocialPlatformId].scopes.join(","),
        nowIso(),
        id,
        companyId,
      ]
    );
    logAudit({ companyId, actor: user, action: "social_account.updated", entity: "social_account", entityId: id, details: `${platform}/${accountName}`, ip: await clientIp() });
  } else {
    const newAccountId = newId();
    run(
      `INSERT INTO social_accounts (id, company_id, platform, account_name, account_ref, status, scopes,
         token_ciphertext, connected_at, last_sync_at, notes, page_url, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        newAccountId,
        companyId,
        platform,
        accountName,
        accountRef,
        status,
        SOCIAL_PLATFORMS[platform as SocialPlatformId].scopes.join(","),
        ciphertext,
        configured ? nowIso() : null,
        configured ? nowIso() : null,
        notes,
        pageUrl,
        user.id,
        nowIso(),
      ]
    );
    logAudit({ companyId, actor: user, action: "social_account.created", entity: "social_account", entityId: newAccountId, details: `${platform}/${accountName}`, ip: await clientIp() });
  }

  revalidatePath("/app/social");
  redirect(
    `/app/social?saved=${enc(
      configured
        ? "Compte enregistré : la publication automatique est disponible pour cette plateforme."
        : "Compte déclaré. La publication automatique reste désactivée tant que l'application officielle n'est pas configurée."
    )}`
  );
}

/** Change l'état d'un compte. « Connecté » exige une intégration officielle configurée. */
export async function setSocialAccountStatusAction(formData: FormData) {
  const user = await requireUser("social.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const account = get<{ platform: string; account_name: string }>(
    "SELECT platform, account_name FROM social_accounts WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
  if (!account) redirect(`/app/social?error=${enc("Compte introuvable.")}`);
  if (!["connected", "pending", "disconnected"].includes(status)) {
    redirect(`/app/social?error=${enc("Statut invalide.")}`);
  }
  if (status === "connected" && !isPlatformConfigured(account.platform)) {
    redirect(
      `/app/social?error=${enc(
        "Impossible de marquer ce compte comme connecté : les identifiants de l'application officielle ne sont pas configurés sur le serveur."
      )}`
    );
  }
  run("UPDATE social_accounts SET status = ?, connected_at = CASE WHEN ? = 'connected' THEN ? ELSE connected_at END WHERE id = ? AND company_id = ?", [
    status,
    status,
    nowIso(),
    id,
    companyId,
  ]);
  logAudit({
    companyId,
    actor: user,
    action: "social_account.status",
    entity: "social_account",
    entityId: id,
    details: `${account.platform}/${account.account_name} → ${status}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/social");
  redirect(`/app/social?saved=${enc("Statut du compte mis à jour")}`);
}

export async function deleteSocialAccountAction(formData: FormData) {
  const user = await requireUser("social.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const account = get<{ platform: string; account_name: string }>(
    "SELECT platform, account_name FROM social_accounts WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
  if (!account) redirect(`/app/social?error=${enc("Compte introuvable.")}`);
  run("DELETE FROM social_accounts WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({
    companyId,
    actor: user,
    action: "social_account.deleted",
    entity: "social_account",
    entityId: id,
    details: `${account.platform}/${account.account_name}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/social");
  redirect(`/app/social?saved=${enc("Compte supprimé")}`);
}
