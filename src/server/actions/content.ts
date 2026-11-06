"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, count, get, newId, nowIso, run, transaction } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { MAX_UPLOAD_BYTES } from "@/lib/media";
import { contentSchema, zodMessage } from "@/lib/validation";

const COMPANY_SCOPED_TABLES = ["contents", "media", "campaigns", "social_accounts", "contacts", "products", "tasks"];

function enc(value: string) {
  return encodeURIComponent(value);
}

function sanitizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function assertOwnerCompany(table: string, id: string | null | undefined, companyId: string): boolean {
  if (!id) return true;
  if (!COMPANY_SCOPED_TABLES.includes(table)) return false;
  const row = get<{ id: string }>(`SELECT id FROM ${table} WHERE id = ? AND company_id = ?`, [id, companyId]);
  return Boolean(row);
}

/** Cree un contenu (Module 03) et sa premiere revision. */
export async function createContentAction(formData: FormData) {
  const user = await requireUser("content.create");
  const companyId = user.companyId!;
  const parsed = contentSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") || "post",
    body: formData.get("body") ?? "",
    tone: formData.get("tone") ?? "",
    status: formData.get("status") || "draft",
    campaignId: formData.get("campaignId") || null,
    assigneeId: formData.get("assigneeId") || null,
    scheduledAt: formData.get("scheduledAt") ?? "",
    tags: formData.get("tags") ?? "",
  });
  if (!parsed.success) {
    redirect(`/app/content?error=${enc(zodMessage(parsed.error))}`);
  }
  if (!assertOwnerCompany("campaigns", parsed.data.campaignId, companyId)) {
    redirect(`/app/content?error=${enc("Campagne invalide.")}`);
  }
  if (parsed.data.assigneeId && !get("SELECT id FROM users WHERE id = ? AND company_id = ?", [parsed.data.assigneeId, companyId])) {
    redirect(`/app/content?error=${enc("Collaborateur invalide.")}`);
  }

  const id = newId();
  const scheduledAt = sanitizeDate(parsed.data.scheduledAt);
  const status = scheduledAt && parsed.data.status === "draft" ? "scheduled" : parsed.data.status;
  run(
    `INSERT INTO contents (id, company_id, type, title, body, tone, status, campaign_id, assignee_id, author_id,
       scheduled_at, tags, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      companyId,
      parsed.data.type,
      parsed.data.title,
      parsed.data.body,
      parsed.data.tone || null,
      status,
      parsed.data.campaignId || null,
      parsed.data.assigneeId || null,
      user.id,
      scheduledAt,
      parsed.data.tags || null,
      formData.get("source") === "ai" ? "ai" : "manual",
      nowIso(),
      nowIso(),
    ]
  );
  run(
    "INSERT INTO content_revisions (id, content_id, company_id, title, body, author_id, created_at) VALUES (?,?,?,?,?,?,?)",
    [newId(), id, companyId, parsed.data.title, parsed.data.body, user.id, nowIso()]
  );
  logAudit({ companyId, actor: user, action: "content.created", entity: "content", entityId: id, details: parsed.data.title, ip: await clientIp() });
  if (parsed.data.assigneeId && parsed.data.assigneeId !== user.id) {
    notify({
      companyId,
      type: "content",
      title: "Nouveau contenu à traiter",
      body: parsed.data.title,
      link: `/app/content/${id}`,
      userId: parsed.data.assigneeId,
    });
  }
  revalidatePath("/app/content");
  revalidatePath("/app/calendar");
  redirect(`/app/content/${id}?saved=${enc("Contenu créé")}`);
}

/** Met a jour un contenu et archive la version precedente. */
export async function updateContentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requireUser("content.edit");
  const companyId = user.companyId!;
  const existing = get<{ id: string; title: string; body: string; status: string }>(
    "SELECT id, title, body, status FROM contents WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
  if (!existing) redirect(`/app/content?error=${enc("Contenu introuvable.")}`);

  const parsed = contentSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") || "post",
    body: formData.get("body") ?? "",
    tone: formData.get("tone") ?? "",
    status: formData.get("status") || existing.status,
    campaignId: formData.get("campaignId") || null,
    assigneeId: formData.get("assigneeId") || null,
    scheduledAt: formData.get("scheduledAt") ?? "",
    tags: formData.get("tags") ?? "",
  });
  if (!parsed.success) {
    redirect(`/app/content/${id}?error=${enc(zodMessage(parsed.error))}`);
  }
  if (!assertOwnerCompany("campaigns", parsed.data.campaignId, companyId)) {
    redirect(`/app/content/${id}?error=${enc("Campagne invalide.")}`);
  }
  if (parsed.data.assigneeId && !get("SELECT id FROM users WHERE id = ? AND company_id = ?", [parsed.data.assigneeId, companyId])) {
    redirect(`/app/content/${id}?error=${enc("Collaborateur invalide.")}`);
  }
  if (parsed.data.status !== existing.status && !user.permissions.includes("content.publish")) {
    redirect(`/app/content/${id}?error=${enc("Vous ne pouvez pas modifier le statut.")}`);
  }

  const scheduledAt = sanitizeDate(parsed.data.scheduledAt);
  transaction(() => {
    if (existing.title !== parsed.data.title || existing.body !== parsed.data.body) {
      run(
        "INSERT INTO content_revisions (id, content_id, company_id, title, body, author_id, created_at) VALUES (?,?,?,?,?,?,?)",
        [newId(), id, companyId, existing.title, existing.body, user.id, nowIso()]
      );
    }
    run(
      `UPDATE contents SET title = ?, type = ?, body = ?, tone = ?, status = ?, campaign_id = ?, assignee_id = ?,
         scheduled_at = ?, tags = ?, updated_at = ? WHERE id = ? AND company_id = ?`,
      [
        parsed.data.title,
        parsed.data.type,
        parsed.data.body,
        parsed.data.tone || null,
        parsed.data.status,
        parsed.data.campaignId || null,
        parsed.data.assigneeId || null,
        scheduledAt,
        parsed.data.tags || null,
        nowIso(),
        id,
        companyId,
      ]
    );
  });
  logAudit({ companyId, actor: user, action: "content.updated", entity: "content", entityId: id, details: parsed.data.title, ip: await clientIp() });
  revalidatePath(`/app/content/${id}`);
  revalidatePath("/app/content");
  revalidatePath("/app/calendar");
  redirect(`/app/content/${id}?saved=${enc("Contenu enregistré")}`);
}

/** Change uniquement le statut (workflow de validation). */
export async function setContentStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  const allowed = ["draft", "in_progress", "in_review", "approved", "scheduled", "published", "cancelled"];
  if (!allowed.includes(nextStatus)) redirect(`/app/content/${id}?error=${enc("Statut invalide.")}`);

  const user = await requireUser("content.edit");
  const companyId = user.companyId!;
  const content = get<{ id: string; title: string; social_account_id: string | null; scheduled_at: string | null }>(
    "SELECT id, title, social_account_id, scheduled_at FROM contents WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
  if (!content) redirect(`/app/content?error=${enc("Contenu introuvable.")}`);

  const needsApprove = ["approved", "published"].includes(nextStatus);
  const needsPublish = ["scheduled", "published", "cancelled"].includes(nextStatus);
  if (needsApprove && !user.permissions.includes("content.approve") && !user.permissions.includes("content.publish")) {
    redirect(`/app/content/${id}?error=${enc("Permission de validation requise.")}`);
  }
  if (needsPublish && !user.permissions.includes("content.publish")) {
    redirect(`/app/content/${id}?error=${enc("Permission de publication requise.")}`);
  }

  const now = nowIso();
  run("UPDATE contents SET status = ?, updated_at = ? WHERE id = ? AND company_id = ?", [nextStatus, now, id, companyId]);

  // Une publication marquee "publiée" l'est toujours manuellement : aucune API
  // officielle n'etant connectee, la plateforme ne simule jamais un envoi.
  if (nextStatus === "published") {
    run("UPDATE contents SET published_at = ? WHERE id = ? AND company_id = ?", [now, id, companyId]);
    const accounts = content.social_account_id
      ? [{ id: content.social_account_id }]
      : all<{ id: string; platform: string }>(
          "SELECT id, platform FROM social_accounts WHERE company_id = ? AND status = 'connected'",
          [companyId]
        );
    for (const account of accounts) {
      const platform =
        (get<{ platform: string }>("SELECT platform FROM social_accounts WHERE id = ? AND company_id = ?", [account.id, companyId])
          ?.platform ?? "other");
      const existing = get<{ id: string }>(
        "SELECT id FROM publications WHERE content_id = ? AND social_account_id = ?",
        [id, account.id]
      );
      if (existing) {
        run("UPDATE publications SET status = 'published', published_at = ?, method = 'manual' WHERE id = ?", [now, existing.id]);
      } else {
        run(
          `INSERT INTO publications (id, company_id, content_id, social_account_id, platform, method, status, published_at, created_by, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [newId(), companyId, id, account.id, platform, "manual", "published", now, user.id, now]
        );
      }
    }
    notify({ companyId, type: "content", title: "Contenu publié (manuel)", body: content.title, link: `/app/content/${id}` });
  }

  if (nextStatus === "cancelled") {
    run("UPDATE publications SET status = 'cancelled' WHERE content_id = ? AND company_id = ? AND status = 'queued'", [id, companyId]);
  }

  logAudit({ companyId, actor: user, action: `content.status.${nextStatus}`, entity: "content", entityId: id, details: content.title, ip: await clientIp() });
  revalidatePath(`/app/content/${id}`);
  revalidatePath("/app/content");
  revalidatePath("/app/calendar");
  revalidatePath("/app");
}

/** Programme le contenu et prepare les publications (procedure manuelle ou API). */
export async function scheduleContentAction(formData: FormData) {
  const user = await requireUser("content.publish");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const scheduledAt = sanitizeDate(String(formData.get("scheduledAt") ?? ""));
  const accountIds = formData.getAll("socialAccountIds").map(String).filter(Boolean);
  if (!scheduledAt) redirect(`/app/content/${id}?error=${enc("Date de programmation invalide.")}`);
  const content = get<{ id: string; title: string }>("SELECT id, title FROM contents WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!content) redirect(`/app/content?error=${enc("Contenu introuvable.")}`);

  const validAccounts = all<{ id: string; platform: string; status: string }>(
    `SELECT id, platform, status FROM social_accounts WHERE company_id = ? AND id IN (${accountIds.map(() => "?").join(",") || "''"})`,
    [companyId, ...accountIds]
  );

  transaction(() => {
    run("UPDATE contents SET status = 'scheduled', scheduled_at = ?, updated_at = ? WHERE id = ? AND company_id = ?", [
      scheduledAt,
      nowIso(),
      id,
      companyId,
    ]);
    if (validAccounts.length > 0) {
      run("UPDATE contents SET social_account_id = ? WHERE id = ? AND company_id = ?", [validAccounts[0].id, id, companyId]);
    }
    run("DELETE FROM publications WHERE content_id = ? AND company_id = ? AND status = 'queued'", [id, companyId]);
    for (const account of validAccounts) {
      run(
        `INSERT INTO publications (id, company_id, content_id, social_account_id, platform, method, status, scheduled_at, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          newId(),
          companyId,
          id,
          account.id,
          account.platform,
          account.status === "connected" ? "api" : "manual",
          "queued",
          scheduledAt,
          user.id,
          nowIso(),
        ]
      );
    }
  });

  notify({
    companyId,
    type: "content",
    title: "Contenu programmé",
    body: `${content.title} — ${new Date(scheduledAt).toLocaleString("fr-FR")}`,
    link: `/app/calendar?date=${scheduledAt.slice(0, 10)}`,
  });
  logAudit({ companyId, actor: user, action: "content.scheduled", entity: "content", entityId: id, details: scheduledAt, ip: await clientIp() });
  revalidatePath(`/app/content/${id}`);
  revalidatePath("/app/calendar");
  redirect(`/app/content/${id}?saved=${enc("Contenu programmé")}`);
}

/** Marque un contenu comme publié manuellement (aucune API simulee). */
export async function markPublishedAction(formData: FormData) {
  await setContentStatusAction(formData);
}

export async function duplicateContentAction(formData: FormData) {
  const user = await requireUser("content.create");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const source = get<{
    type: string;
    title: string;
    body: string;
    tone: string | null;
    campaign_id: string | null;
    tags: string | null;
  }>("SELECT type, title, body, tone, campaign_id, tags FROM contents WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!source) redirect(`/app/content?error=${enc("Contenu introuvable.")}`);
  const newContentId = newId();
  run(
    `INSERT INTO contents (id, company_id, type, title, body, tone, status, campaign_id, author_id, tags, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newContentId,
      companyId,
      source.type,
      `${source.title} (copie)`,
      source.body,
      source.tone,
      "draft",
      source.campaign_id,
      user.id,
      source.tags,
      "manual",
      nowIso(),
      nowIso(),
    ]
  );
  logAudit({ companyId, actor: user, action: "content.duplicated", entity: "content", entityId: newContentId, details: source.title, ip: await clientIp() });
  revalidatePath("/app/content");
  redirect(`/app/content/${newContentId}?saved=${enc("Contenu dupliqué")}`);
}

export async function archiveContentAction(formData: FormData) {
  const user = await requireUser("content.edit");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const restore = formData.get("restore") === "1";
  run("UPDATE contents SET archived_at = ?, updated_at = ? WHERE id = ? AND company_id = ?", [
    restore ? null : nowIso(),
    nowIso(),
    id,
    companyId,
  ]);
  logAudit({ companyId, actor: user, action: restore ? "content.restored" : "content.archived", entity: "content", entityId: id, ip: await clientIp() });
  revalidatePath("/app/content");
  redirect(`/app/content?saved=${enc(restore ? "Contenu restauré" : "Contenu archivé")}`);
}

export async function deleteContentAction(formData: FormData) {
  const user = await requireUser("content.delete");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const content = get<{ title: string }>("SELECT title FROM contents WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!content) redirect(`/app/content?error=${enc("Contenu introuvable.")}`);
  run("DELETE FROM contents WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({ companyId, actor: user, action: "content.deleted", entity: "content", entityId: id, details: content.title, ip: await clientIp() });
  revalidatePath("/app/content");
  redirect(`/app/content?saved=${enc("Contenu supprimé")}`);
}

export async function addContentCommentAction(formData: FormData) {
  const user = await requireUser("content.view");
  const companyId = user.companyId!;
  const contentId = String(formData.get("contentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) redirect(`/app/content/${contentId}?error=${enc("Commentaire vide.")}`);
  if (!get("SELECT id FROM contents WHERE id = ? AND company_id = ?", [contentId, companyId])) {
    redirect(`/app/content?error=${enc("Contenu introuvable.")}`);
  }
  run(
    "INSERT INTO content_comments (id, company_id, content_id, author_id, body, created_at) VALUES (?,?,?,?,?,?)",
    [newId(), companyId, contentId, user.id, body.slice(0, 4000), nowIso()]
  );
  logAudit({ companyId, actor: user, action: "content.comment", entity: "content", entityId: contentId, ip: await clientIp() });
  revalidatePath(`/app/content/${contentId}`);
}

export async function attachMediaAction(formData: FormData) {
  const user = await requireUser("content.edit");
  const companyId = user.companyId!;
  const contentId = String(formData.get("contentId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  if (!get("SELECT id FROM contents WHERE id = ? AND company_id = ?", [contentId, companyId])) {
    redirect(`/app/content?error=${enc("Contenu introuvable.")}`);
  }
  if (!get("SELECT id FROM media WHERE id = ? AND company_id = ?", [mediaId, companyId])) {
    redirect(`/app/content/${contentId}?error=${enc("Fichier introuvable.")}`);
  }
  run("DELETE FROM content_media WHERE content_id = ? AND media_id = ?", [contentId, mediaId]);
  run("INSERT INTO content_media (content_id, media_id) VALUES (?, ?)", [contentId, mediaId]);
  logAudit({ companyId, actor: user, action: "content.media.attach", entity: "content", entityId: contentId, details: mediaId, ip: await clientIp() });
  revalidatePath(`/app/content/${contentId}`);
}

export async function detachMediaAction(formData: FormData) {
  const user = await requireUser("content.edit");
  const companyId = user.companyId!;
  const contentId = String(formData.get("contentId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  if (!get("SELECT id FROM contents WHERE id = ? AND company_id = ?", [contentId, companyId])) {
    redirect(`/app/content?error=${enc("Contenu introuvable.")}`);
  }
  run("DELETE FROM content_media WHERE content_id = ? AND media_id = ?", [contentId, mediaId]);
  revalidatePath(`/app/content/${contentId}`);
}

/** Statistiques rapides utilisees par les pages du module contenus. */
export async function contentCounts(companyId: string) {
  return {
    total: count("SELECT COUNT(*) AS n FROM contents WHERE company_id = ? AND archived_at IS NULL", [companyId]),
    maxUpload: MAX_UPLOAD_BYTES,
  };
}
