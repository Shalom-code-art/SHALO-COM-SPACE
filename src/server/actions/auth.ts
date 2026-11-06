"use server";

import { redirect } from "next/navigation";
import { acceptInvitation, clientIp, login, logout, registerCompany } from "@/lib/auth";
import { get, newId, nowIso, run } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loginSchema, registerSchema, zodMessage } from "@/lib/validation";
import { sha256 } from "@/lib/crypto";

function encode(value: string): string {
  return encodeURIComponent(value);
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    redirect(`/login?error=${encode(zodMessage(parsed.error))}&email=${encode(email)}`);
  }
  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    redirect(`/login?error=${encode(result.error)}&email=${encode(email)}`);
  }
  const user = get<{ role: string }>("SELECT role FROM users WHERE id = ?", [result.userId]);
  redirect(user?.role === "platform_admin" ? "/admin" : "/app");
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) {
    redirect(`/register?error=${encode(zodMessage(parsed.error))}`);
  }
  if (formData.get("acceptTerms") !== "on") {
    redirect(`/register?error=${encode("Vous devez accepter la politique de confidentialité.")}`);
  }
  const result = await registerCompany(parsed.data);
  if (!result.ok) {
    redirect(`/register?error=${encode(result.error)}`);
  }
  const session = await login(parsed.data.email, parsed.data.password);
  if (!session.ok) redirect("/login?error=Connexion automatique impossible.");
  redirect("/app");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) redirect(`/invitation/${token}?error=${encode("Nom requis.")}`);
  if (password.length < 8) redirect(`/invitation/${token}?error=${encode("8 caractères minimum.")}`);

  const invitation = get<{ email: string; company_id: string }>(
    "SELECT email, company_id FROM invitations WHERE token_hash = ? AND accepted_at IS NULL",
    [sha256(token)]
  );
  const result = await acceptInvitation({ token, name, password });
  if (!result.ok) redirect(`/invitation/${token}?error=${encode(result.error)}`);
  if (!invitation) redirect("/login");
  const session = await login(invitation.email, password);
  if (!session.ok) redirect("/login");
  redirect("/app");
}

/** Reinitialisation du mot de passe par un proprietaire (depuis Parametres > Equipe). */
export async function resetMemberPasswordAction(formData: FormData) {
  const { requireUser } = await import("@/lib/auth");
  const { hashPassword } = await import("@/lib/crypto");
  const user = await requireUser("team.manage");
  const memberId = String(formData.get("memberId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect(`/app/team?error=${encode("8 caractères minimum.")}`);
  }
  const member = get<{ id: string; company_id: string }>("SELECT id, company_id FROM users WHERE id = ?", [memberId]);
  if (!member || member.company_id !== user.companyId) {
    redirect(`/app/team?error=${encode("Collaborateur introuvable.")}`);
  }
  run("UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?", [
    hashPassword(password),
    nowIso(),
    memberId,
  ]);
  run("UPDATE sessions SET revoked_at = ? WHERE user_id = ?", [nowIso(), memberId]);
  logAudit({
    companyId: user.companyId,
    actor: user,
    action: "user.password_reset",
    entity: "user",
    entityId: memberId,
    ip: await clientIp(),
  });
  redirect("/app/team?saved=Mot de passe réinitialisé");
}

/** Cree un administrateur plateforme BATIANA TECH (premier demarrage). */
export async function bootstrapPlatformAdminAction(formData: FormData) {
  const existing = get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'platform_admin'");
  if (existing && Number(existing.n) > 0) {
    redirect("/login?error=Un administrateur plateforme existe déjà.");
  }
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || !email || password.length < 10) {
    redirect(`/setup?error=${encode("Nom, email et mot de passe (10 caractères min.) requis.")}`);
  }
  const { hashPassword } = await import("@/lib/crypto");
  const id = newId();
  run(
    "INSERT INTO users (id, company_id, name, email, password_hash, role, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, null, name, email, hashPassword(password), "platform_admin", "active", nowIso(), nowIso()]
  );
  logAudit({ actor: { id, name, role: "platform_admin" }, action: "platform.admin_created", entity: "user", entityId: id });
  const session = await login(email, password);
  if (!session.ok) redirect("/login");
  redirect("/admin");
}

