"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { get, newId, nowIso, run } from "@/lib/db";

function enc(value: string) {
  return encodeURIComponent(value);
}

function analyticsUrl(url: string) {
  return `/app/analytics?${url}`;
}

function toInt(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "0").replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

/** Releve d'audience saisi manuellement (source = manual). Aucune valeur inventee. */
export async function saveAudienceSnapshotAction(formData: FormData) {
  const user = await requireUser("analytics.manage");
  const companyId = user.companyId!;
  const platform = String(formData.get("platform") ?? "").trim();
  const capturedOn = String(formData.get("capturedOn") ?? "").trim() || nowIso().slice(0, 10);
  if (!platform) redirect(analyticsUrl(`error=${enc("Sélectionnez une plateforme.")}`));

  const account = get<{ id: string }>(
    "SELECT id FROM social_accounts WHERE company_id = ? AND platform = ? LIMIT 1",
    [companyId, platform]
  );

  run(
    `INSERT INTO analytics_snapshots (id, company_id, social_account_id, platform, captured_on, followers, reach,
       impressions, engagement, posts_published, source, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      companyId,
      account?.id ?? null,
      platform,
      capturedOn,
      toInt(formData.get("followers")),
      toInt(formData.get("reach")),
      toInt(formData.get("impressions")),
      toInt(formData.get("engagement")),
      toInt(formData.get("postsPublished")),
      "manual",
      user.id,
      nowIso(),
    ]
  );

  logAudit({ companyId, actor: user, action: "analytics.snapshot", entity: "analytics_snapshot", details: `${platform} · ${capturedOn}`, ip: await clientIp() });
  revalidatePath("/app/analytics");
  redirect(analyticsUrl(`saved=${enc("Relevé enregistré")}`));
}

/** Mesures d'une publication (impressions, portee, engagement, clics). */
export async function savePublicationMetricsAction(formData: FormData) {
  const user = await requireUser("analytics.manage");
  const companyId = user.companyId!;
  const publicationId = String(formData.get("publicationId") ?? "");
  const publication = get<{ id: string }>(
    "SELECT id FROM publications WHERE id = ? AND company_id = ?",
    [publicationId, companyId]
  );
  if (!publication) redirect(analyticsUrl(`error=${enc("Publication introuvable.")}`));

  run(
    `INSERT INTO publication_metrics (id, company_id, publication_id, impressions, reach, engagement, clicks, source, captured_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      companyId,
      publicationId,
      toInt(formData.get("impressions")),
      toInt(formData.get("reach")),
      toInt(formData.get("engagement")),
      toInt(formData.get("clicks")),
      "manual",
      nowIso(),
    ]
  );
  logAudit({ companyId, actor: user, action: "analytics.metrics", entity: "publication", entityId: publicationId, ip: await clientIp() });
  revalidatePath("/app/analytics");
  redirect(analyticsUrl(`saved=${enc("Mesures enregistrées")}`));
}

export async function deleteSnapshotAction(formData: FormData) {
  const user = await requireUser("analytics.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const snapshot = get<{ platform: string; captured_on: string }>(
    "SELECT platform, captured_on FROM analytics_snapshots WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
  if (!snapshot) redirect(analyticsUrl(`error=${enc("Relevé introuvable.")}`));
  run("DELETE FROM analytics_snapshots WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({
    companyId,
    actor: user,
    action: "analytics.snapshot_deleted",
    entity: "analytics_snapshot",
    entityId: id,
    details: `${snapshot.platform} · ${snapshot.captured_on}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/analytics");
  redirect(analyticsUrl(`saved=${enc("Relevé supprimé")}`));
}
