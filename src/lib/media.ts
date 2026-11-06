import { all, count, get } from "@/lib/db";

/** Gestion du stockage mediatheque et des quotas (Module 09). */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function mediaKind(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export function storageUsage(companyId: string) {
  const quotaMb = Number(
    get<{ storage_quota_mb: number }>("SELECT storage_quota_mb FROM companies WHERE id = ?", [companyId])
      ?.storage_quota_mb ?? 0
  );
  const used = Number(
    all<{ total: number }>("SELECT COALESCE(SUM(size_bytes),0) AS total FROM media WHERE company_id = ?", [
      companyId,
    ])[0]?.total ?? 0
  );
  const files = count("SELECT COUNT(*) AS n FROM media WHERE company_id = ?", [companyId]);
  const quotaBytes = quotaMb * 1024 * 1024;
  return {
    quotaMb,
    quotaBytes,
    usedBytes: used,
    fileCount: files,
    percent: quotaBytes > 0 ? Math.min(100, Math.round((used / quotaBytes) * 100)) : 0,
    remainingBytes: Math.max(0, quotaBytes - used),
  };
}

export function canUpload(companyId: string, bytes: number): { ok: boolean; error?: string } {
  const usage = storageUsage(companyId);
  if (bytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Fichier trop volumineux : 10 Mo maximum par fichier." };
  }
  if (usage.usedBytes + bytes > usage.quotaBytes) {
    return {
      ok: false,
      error: `Quota de stockage atteint (${usage.quotaMb} Mo). Supprimez des fichiers ou contactez BATIANA TECH pour augmenter le quota.`,
    };
  }
  return { ok: true };
}

/** URL de service d'un fichier mediatheque (controlee par session et entreprise). */
export function mediaUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  return `/api/v1/media/${id}/raw`;
}

/** URL publique limitee aux visuels de la vitrine d'une entreprise. */
export function publicMediaUrl(slug: string | null | undefined, id: string | null | undefined): string | null {
  if (!slug || !id) return null;
  return `/api/shop/${slug}/media/${id}`;
}

/** Nom de fichier sur : retire les chemins et caracteres de controle. */
export function safeFileName(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "fichier";
  return base.replace(/[\u0000-\u001f<>:"|?*]+/g, "_").slice(0, 180) || "fichier";
}
