"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { get, newId, nowIso, run } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { ALL_PERMISSIONS, COMPANY_ROLES, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS, type CompanyRole } from "@/lib/permissions";

function enc(value: string) {
  return encodeURIComponent(value);
}

/* ------------------------------------------------------------------ */
/* Equipe                                                              */
/* ------------------------------------------------------------------ */

export async function inviteMemberAction(formData: FormData) {
  const user = await requireUser("team.manage");
  const companyId = user.companyId!;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "viewer") as CompanyRole;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`/app/team?error=${enc("Adresse email invalide.")}`);
  }
  if (!COMPANY_ROLES.includes(role)) {
    redirect(`/app/team?error=${enc("Rôle invalide.")}`);
  }
  if (get("SELECT id FROM users WHERE email = ?", [email])) {
    redirect(`/app/team?error=${enc("Un compte existe déjà avec cette adresse.")}`);
  }
  const pending = get<{ id: string }>(
    "SELECT id FROM invitations WHERE company_id = ? AND email = ? AND accepted_at IS NULL",
    [companyId, email]
  );
  if (pending) {
    run("DELETE FROM invitations WHERE id = ?", [pending.id]);
  }

  const token = randomToken(24);
  const invitationId = newId();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  run(
    `INSERT INTO invitations (id, company_id, email, role, token_hash, invited_by, expires_at, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [invitationId, companyId, email, role, sha256(token), user.id, expiresAt, nowIso()]
  );
  notify({ companyId, type: "team", title: "Invitation envoyée", body: `${email} · ${ROLE_LABELS[role]}`, link: "/app/team", userId: user.id });
  logAudit({
    companyId,
    actor: user,
    action: "team.invited",
    entity: "invitation",
    entityId: invitationId,
    details: `${email} · ${role}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/team");
  redirect(`/app/team?invited=${token}&saved=${enc("Invitation créée")}`);
}

export async function revokeInvitationAction(formData: FormData) {
  const user = await requireUser("team.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const invitation = get<{ email: string }>(
    "SELECT email FROM invitations WHERE id = ? AND company_id = ? AND accepted_at IS NULL",
    [id, companyId]
  );
  if (!invitation) redirect(`/app/team?error=${enc("Invitation introuvable.")}`);
  run("DELETE FROM invitations WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({
    companyId,
    actor: user,
    action: "team.invitation_revoked",
    entity: "invitation",
    entityId: id,
    details: invitation.email,
    ip: await clientIp(),
  });
  revalidatePath("/app/team");
  redirect(`/app/team?saved=${enc("Invitation annulée")}`);
}

export async function updateMemberRoleAction(formData: FormData) {
  const user = await requireUser("team.manage");
  const companyId = user.companyId!;
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "") as CompanyRole;
  if (!COMPANY_ROLES.includes(role)) redirect(`/app/team?error=${enc("Rôle invalide.")}`);
  const member = get<{ id: string; role: string; name: string }>(
    "SELECT id, role, name FROM users WHERE id = ? AND company_id = ?",
    [memberId, companyId]
  );
  if (!member) redirect(`/app/team?error=${enc("Collaborateur introuvable.")}`);
  if (member.role === "owner" && role !== "owner") {
    const owners = get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = 'owner' AND status = 'active'", [
      companyId,
    ]);
    if (Number(owners?.n ?? 0) <= 1) {
      redirect(`/app/team?error=${enc("Impossible : l'entreprise doit conserver au moins un propriétaire actif.")}`);
    }
  }
  run("UPDATE users SET role = ?, updated_at = ? WHERE id = ? AND company_id = ?", [role, nowIso(), memberId, companyId]);
  logAudit({
    companyId,
    actor: user,
    action: "team.role_changed",
    entity: "user",
    entityId: memberId,
    details: `${member.name} · ${member.role} → ${role}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/team");
  redirect(`/app/team?saved=${enc("Rôle mis à jour")}`);
}

export async function setMemberStatusAction(formData: FormData) {
  const user = await requireUser("team.manage");
  const companyId = user.companyId!;
  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["active", "suspended"].includes(status)) redirect(`/app/team?error=${enc("Statut invalide.")}`);
  if (memberId === user.id) redirect(`/app/team?error=${enc("Vous ne pouvez pas suspendre votre propre compte.")}`);
  const member = get<{ name: string; role: string }>("SELECT name, role FROM users WHERE id = ? AND company_id = ?", [memberId, companyId]);
  if (!member) redirect(`/app/team?error=${enc("Collaborateur introuvable.")}`);
  run("UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND company_id = ?", [status, nowIso(), memberId, companyId]);
  if (status === "suspended") {
    run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [nowIso(), memberId]);
  }
  logAudit({
    companyId,
    actor: user,
    action: status === "suspended" ? "team.member_suspended" : "team.member_reactivated",
    entity: "user",
    entityId: memberId,
    details: member.name,
    ip: await clientIp(),
  });
  revalidatePath("/app/team");
  redirect(`/app/team?saved=${enc(status === "suspended" ? "Accès révoqué" : "Accès réactivé")}`);
}

/** Surcharge des permissions par rôle (hors propriétaire). */
export async function saveRolePermissionsAction(formData: FormData) {
  const user = await requireUser("team.manage");
  const companyId = user.companyId!;
  const role = String(formData.get("role") ?? "") as CompanyRole;
  if (!COMPANY_ROLES.includes(role) || role === "owner") {
    redirect(`/app/team?error=${enc("Ce rôle ne peut pas être modifié.")}`);
  }
  const selected = new Set(formData.getAll("permissions").map((value) => String(value)));
  const defaults = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role] ?? []);

  for (const permission of ALL_PERMISSIONS) {
    if (permission === "platform.manage") continue;
    const allowed = selected.has(permission);
    const isDefault = defaults.has(permission);
    if (allowed === isDefault) {
      run("DELETE FROM role_permissions WHERE company_id = ? AND role = ? AND permission = ?", [companyId, role, permission]);
      continue;
    }
    run(
      `INSERT INTO role_permissions (company_id, role, permission, allowed) VALUES (?,?,?,?)
       ON CONFLICT(company_id, role, permission) DO UPDATE SET allowed = excluded.allowed`,
      [companyId, role, permission, allowed ? 1 : 0]
    );
  }
  logAudit({
    companyId,
    actor: user,
    action: "team.permissions_updated",
    entity: "role",
    entityId: role,
    details: `${selected.size} permission(s) actives`,
    ip: await clientIp(),
  });
  revalidatePath("/app/team");
  redirect(`/app/team?role=${role}&saved=${enc("Permissions du rôle mises à jour")}`);
}

/* ------------------------------------------------------------------ */
/* Taches                                                              */
/* ------------------------------------------------------------------ */

export async function createTaskAction(formData: FormData) {
  const user = await requireUser("team.view");
  const companyId = user.companyId!;
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) redirect(`/app/team?error=${enc("Intitulé de tâche requis.")}`);
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const contentId = String(formData.get("contentId") ?? "") || null;
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  const dueDate = String(formData.get("dueDate") ?? "") || null;
  const priority = String(formData.get("priority") ?? "normal");
  const description = String(formData.get("description") ?? "").trim() || null;

  if (assigneeId && !get("SELECT id FROM users WHERE id = ? AND company_id = ?", [assigneeId, companyId])) {
    redirect(`/app/team?error=${enc("Collaborateur introuvable.")}`);
  }
  if (contentId && !get("SELECT id FROM contents WHERE id = ? AND company_id = ?", [contentId, companyId])) {
    redirect(`/app/team?error=${enc("Contenu introuvable.")}`);
  }
  if (campaignId && !get("SELECT id FROM campaigns WHERE id = ? AND company_id = ?", [campaignId, companyId])) {
    redirect(`/app/team?error=${enc("Campagne introuvable.")}`);
  }

  const id = newId();
  run(
    `INSERT INTO tasks (id, company_id, title, description, assignee_id, content_id, campaign_id, due_date, priority, status, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, companyId, title, description, assigneeId, contentId, campaignId, dueDate, priority, "todo", user.id, nowIso(), nowIso()]
  );
  if (assigneeId && assigneeId !== user.id) {
    notify({ companyId, type: "team", title: "Nouvelle tâche assignée", body: title, link: "/app/team", userId: assigneeId });
  }
  logAudit({ companyId, actor: user, action: "task.created", entity: "task", entityId: id, details: title, ip: await clientIp() });
  revalidatePath("/app/team");
  redirect(`/app/team?saved=${enc("Tâche créée")}`);
}

export async function setTaskStatusAction(formData: FormData) {
  const user = await requireUser("team.view");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["todo", "in_progress", "blocked", "done"].includes(status)) {
    redirect(`/app/team?error=${enc("Statut de tâche invalide.")}`);
  }
  const task = get<{ title: string }>("SELECT title FROM tasks WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!task) redirect(`/app/team?error=${enc("Tâche introuvable.")}`);
  run("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND company_id = ?", [status, nowIso(), id, companyId]);
  logAudit({ companyId, actor: user, action: "task.status", entity: "task", entityId: id, details: `${task.title} → ${status}`, ip: await clientIp() });
  revalidatePath("/app/team");
  redirect(`/app/team?saved=${enc("Tâche mise à jour")}`);
}

export async function deleteTaskAction(formData: FormData) {
  const user = await requireUser("team.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const task = get<{ title: string }>("SELECT title FROM tasks WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!task) redirect(`/app/team?error=${enc("Tâche introuvable.")}`);
  run("DELETE FROM tasks WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({ companyId, actor: user, action: "task.deleted", entity: "task", entityId: id, details: task.title, ip: await clientIp() });
  revalidatePath("/app/team");
  redirect(`/app/team?saved=${enc("Tâche supprimée")}`);
}
