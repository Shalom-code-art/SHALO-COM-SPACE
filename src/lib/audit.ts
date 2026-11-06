import { newId, nowIso, run } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { SessionUser } from "@/lib/auth";

/** Journalisation des operations sensibles (Module 12). */
export function logAudit(input: {
  companyId?: string | null;
  actor?: { id: string; name: string; role: string } | SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ip?: string | null;
}) {
  const actor = input.actor as
    | { id: string; name: string; role: string }
    | null
    | undefined;
  run(
    `INSERT INTO audit_logs (id, company_id, actor_id, actor_name, actor_role, action, entity, entity_id, details, ip, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      input.companyId ?? null,
      actor?.id ?? null,
      actor?.name ?? "Système",
      actor?.role ?? "system",
      input.action,
      input.entity,
      input.entityId ?? null,
      input.details ?? null,
      input.ip ?? null,
      nowIso(),
    ]
  );
}

/** Notification interne (cloche de la barre supérieure). */
export function notify(input: {
  companyId: string;
  type?: "info" | "content" | "campaign" | "team" | "social" | "alert";
  title: string;
  body?: string;
  link?: string;
  userId?: string | null;
}) {
  const type = input.type ?? "info";
  // Les preferences de notification de l'entreprise peuvent desactiver un type.
  if (type !== "info" && getSettings(input.companyId)[`notifications.${type}`] === "off") return;
  run(
    "INSERT INTO notifications (id, company_id, user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [
      newId(),
      input.companyId,
      input.userId ?? null,
      type,
      input.title,
      input.body ?? null,
      input.link ?? null,
      nowIso(),
    ]
  );
}
