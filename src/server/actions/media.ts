"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { get, newId, nowIso, run } from "@/lib/db";
import { ALLOWED_MIME, canUpload, mediaKind, safeFileName, storageUsage } from "@/lib/media";

function enc(value: string) {
  return encodeURIComponent(value);
}

/** Import de fichiers dans la mediatheque de l'entreprise (Module 09). */
export async function uploadMediaAction(formData: FormData) {
  const user = await requireUser("media.manage");
  const companyId = user.companyId!;
  const folder = String(formData.get("folder") ?? "").trim() || "Général";
  const tags = String(formData.get("tags") ?? "").trim() || null;
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    redirect(`/app/media?error=${enc("Sélectionnez au moins un fichier à importer.")}`);
  }

  let saved = 0;
  const rejected: string[] = [];

  for (const file of files) {
    const name = safeFileName(file.name);
    if (!ALLOWED_MIME.has(file.type)) {
      rejected.push(`${name} (format non autorisé)`);
      continue;
    }
    const quota = canUpload(companyId, file.size);
    if (!quota.ok) {
      rejected.push(`${name} (${quota.error})`);
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = newId();
    run(
      `INSERT INTO media (id, company_id, name, mime, kind, size_bytes, folder, tags, data, uploaded_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, companyId, name, file.type, mediaKind(file.type), bytes.byteLength, folder, tags, bytes, user.id, nowIso()]
    );
    saved += 1;
  }

  const usage = storageUsage(companyId);
  logAudit({
    companyId,
    actor: user,
    action: "media.uploaded",
    entity: "media",
    details: `${saved} fichier(s) · ${usage.usedBytes} octets utilisés sur ${usage.quotaBytes}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/media");

  if (saved === 0) {
    redirect(`/app/media?error=${enc(`Aucun fichier importé. ${rejected.join(" · ")}`.trim())}`);
  }
  const warning = rejected.length ? ` — ignorés : ${rejected.join(", ")}` : "";
  redirect(`/app/media?saved=${enc(`${saved} fichier(s) importé(s)${warning}`)}`);
}

/** Renomme un fichier, le déplace dans un dossier ou met à jour ses étiquettes. */
export async function updateMediaAction(formData: FormData) {
  const user = await requireUser("media.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const existing = get<{ name: string }>("SELECT name FROM media WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!existing) redirect(`/app/media?error=${enc("Fichier introuvable.")}`);

  const name = safeFileName(String(formData.get("name") ?? existing.name));
  const folder = String(formData.get("folder") ?? "").trim() || "Général";
  const tags = String(formData.get("tags") ?? "").trim() || null;
  run("UPDATE media SET name = ?, folder = ?, tags = ? WHERE id = ? AND company_id = ?", [
    name,
    folder,
    tags,
    id,
    companyId,
  ]);
  logAudit({ companyId, actor: user, action: "media.updated", entity: "media", entityId: id, details: name, ip: await clientIp() });
  revalidatePath("/app/media");
  redirect(`/app/media?saved=${enc("Fichier mis à jour")}`);
}

export async function deleteMediaAction(formData: FormData) {
  const user = await requireUser("media.delete");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const file = get<{ name: string; size_bytes: number }>(
    "SELECT name, size_bytes FROM media WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
  if (!file) redirect(`/app/media?error=${enc("Fichier introuvable.")}`);
  run("DELETE FROM media WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({
    companyId,
    actor: user,
    action: "media.deleted",
    entity: "media",
    entityId: id,
    details: `${file.name} (${file.size_bytes} octets)`,
    ip: await clientIp(),
  });
  revalidatePath("/app/media");
  redirect(`/app/media?saved=${enc("Fichier supprimé")}`);
}
