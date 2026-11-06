"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requirePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { get, nowIso, run } from "@/lib/db";

function enc(value: string) {
  return encodeURIComponent(value);
}

const PLANS = ["starter", "standard", "premium", "enterprise"];
const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "suspended", "cancelled"];
const COMPANY_STATUSES = ["active", "suspended", "archived"];

/* ------------------------------------------------------------------ */
/* Abonnement & statut                                                 */
/* ------------------------------------------------------------------ */

export async function updateCompanyAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const company = get<{ id: string; name: string; plan: string; subscription_status: string; status: string; storage_quota_mb: number }>(
    "SELECT id, name, plan, subscription_status, status, storage_quota_mb FROM companies WHERE id = ?",
    [companyId]
  );
  if (!company) redirect(`/admin/companies?error=${enc("Entreprise introuvable.")}`);

  const plan = String(formData.get("plan") ?? company.plan);
  const subscriptionStatus = String(formData.get("subscriptionStatus") ?? company.subscription_status);
  const status = String(formData.get("status") ?? company.status);
  const quota = Number(formData.get("storageQuotaMb") ?? company.storage_quota_mb);
  const renewsAt = String(formData.get("renewsAt") ?? "").trim() || null;

  if (!PLANS.includes(plan)) redirect(`/admin/companies/${companyId}?error=${enc("Formule invalide.")}`);
  if (!SUBSCRIPTION_STATUSES.includes(subscriptionStatus)) {
    redirect(`/admin/companies/${companyId}?error=${enc("Statut d'abonnement invalide.")}`);
  }
  if (!COMPANY_STATUSES.includes(status)) redirect(`/admin/companies/${companyId}?error=${enc("Statut invalide.")}`);
  if (!Number.isFinite(quota) || quota < 64 || quota > 512_000) {
    redirect(`/admin/companies/${companyId}?error=${enc("Quota de stockage invalide (64 à 512000 Mo).")}`);
  }

  run(
    `UPDATE companies SET plan = ?, subscription_status = ?, status = ?, storage_quota_mb = ?,
       subscription_renews_at = ?, updated_at = ? WHERE id = ?`,
    [plan, subscriptionStatus, status, Math.round(quota), renewsAt, nowIso(), companyId]
  );

  if (status !== company.status) {
    // Une suspension coupe immediatement les sessions des utilisateurs de l'entreprise.
    run(
      `UPDATE sessions SET revoked_at = ? WHERE revoked_at IS NULL AND user_id IN
        (SELECT id FROM users WHERE company_id = ?)`,
      [nowIso(), companyId]
    );
  }

  logAudit({
    companyId,
    actor: admin,
    action: "platform.company_updated",
    entity: "company",
    entityId: companyId,
    details: `Formule ${company.plan} → ${plan} · abonnement ${company.subscription_status} → ${subscriptionStatus} · statut ${company.status} → ${status} · quota ${company.storage_quota_mb} → ${Math.round(quota)} Mo`,
    ip: await clientIp(),
  });
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}?saved=${enc("Entreprise mise à jour")}`);
}

/* ------------------------------------------------------------------ */
/* Demande de suppression                                              */
/* ------------------------------------------------------------------ */

/**
 * Traitement d'une demande de suppression : l'administrateur doit recopier
 * le nom exact de l'entreprise. Toutes les donnees liees sont supprimees par
 * cascade, et l'operation reste tracee dans le journal d'audit.
 */
export async function deleteCompanyAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const confirmation = String(formData.get("confirm") ?? "").trim();
  const company = get<{ id: string; name: string; slug: string }>("SELECT id, name, slug FROM companies WHERE id = ?", [
    companyId,
  ]);
  if (!company) redirect(`/admin/companies?error=${enc("Entreprise introuvable.")}`);
  if (confirmation !== company.name) {
    redirect(`/admin/companies/${companyId}?error=${enc("Recopiez exactement le nom de l'entreprise pour confirmer.")}`);
  }

  logAudit({
    companyId: null,
    actor: admin,
    action: "platform.company_deleted",
    entity: "company",
    entityId: companyId,
    details: `Suppression definitive : ${company.name} (${company.slug})`,
    ip: await clientIp(),
  });
  run("DELETE FROM companies WHERE id = ?", [companyId]);
  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  redirect(`/admin/companies?saved=${enc("Entreprise et donnees associees supprimees")}`);
}
