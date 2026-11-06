import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { all, count, get, newId, nowIso, run } from "@/lib/db";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import { effectivePermissions, hasPermission, type Permission, type Role } from "@/lib/permissions";

export const SESSION_COOKIE = "shalo_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

export type Company = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  shop_enabled: number;
  shop_tagline: string | null;
  shop_about: string | null;
  storage_quota_mb: number;
  plan: string;
  subscription_status: string;
  status: string;
  created_at: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  companyId: string | null;
  company: Company | null;
  permissions: Permission[];
  isPlatformAdmin: boolean;
};

type UserRow = {
  id: string;
  company_id: string | null;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  must_change_password: number;
};

export async function clientIp(): Promise<string> {
  const headerBag = await headers();
  const forwarded = headerBag.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0] : headerBag.get("x-real-ip")) || "local";
}

export function loadPermissions(userId: string): { permissions: Permission[]; role: Role } | null {
  const user = get<{ role: string; company_id: string | null }>(
    "SELECT role, company_id FROM users WHERE id = ?",
    [userId]
  );
  if (!user) return null;
  const role = user.role as Role;
  if (!user.company_id) return { permissions: effectivePermissions(role), role };
  const overrides = all<{ permission: string; allowed: number }>(
    "SELECT permission, allowed FROM role_permissions WHERE company_id = ? AND role = ?",
    [user.company_id, role]
  );
  return { permissions: effectivePermissions(role, overrides), role };
}

async function hydrate(userId: string): Promise<SessionUser | null> {
  const user = get<UserRow & { company_id: string | null }>(
    "SELECT id, company_id, name, email, password_hash, role, status, must_change_password FROM users WHERE id = ?",
    [userId]
  );
  if (!user || user.status !== "active") return null;
  const company = user.company_id
    ? get<Company>("SELECT * FROM companies WHERE id = ?", [user.company_id])
    : null;
  const access = loadPermissions(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    status: user.status,
    companyId: user.company_id,
    company,
    permissions: access?.permissions ?? [],
    isPlatformAdmin: user.role === "platform_admin",
  };
}

/** Utilisateur courant (memoise par requete). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = get<{ user_id: string; expires_at: string; revoked_at: string | null }>(
    "SELECT user_id, expires_at, revoked_at FROM sessions WHERE token_hash = ?",
    [sha256(token)]
  );
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  return hydrate(session.user_id);
});

export async function requireUser(permission?: Permission | Permission[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // L'administrateur plateforme n'a pas d'espace entreprise : il est redirige
  // vers la console BATIANA TECH et n'accede pas aux donnees clients.
  if (user.isPlatformAdmin) {
    redirect("/admin");
  }
  if (!user.company || user.company.status !== "active") {
    redirect("/suspended");
  }
  if (permission && !hasPermission(user.permissions, permission)) {
    const first = Array.isArray(permission) ? permission[0] : permission;
    redirect(`/app?denied=${encodeURIComponent(first)}`);
  }
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/app?denied=platform.manage");
  return user;
}

export async function requireApiUser(permission?: Permission | Permission[]): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isPlatformAdmin) return user;
  if (permission && !hasPermission(user.permissions, permission)) return null;
  return user;
}

function isLocked(identifier: string, ip: string): boolean {
  const since = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
  const attempts = count(
    "SELECT COUNT(*) AS n FROM login_attempts WHERE success = 0 AND created_at > ? AND (identifier = ? OR ip = ?)",
    [since, identifier.toLowerCase(), ip]
  );
  return attempts >= MAX_FAILED_ATTEMPTS;
}

function recordAttempt(identifier: string, ip: string, success: boolean) {
  run("INSERT INTO login_attempts (identifier, ip, success) VALUES (?, ?, ?)", [
    identifier.toLowerCase(),
    ip,
    success,
  ]);
}

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const identifier = email.trim().toLowerCase();
  if (isLocked(identifier, ip)) {
    return {
      ok: false,
      error: "Trop de tentatives de connexion. Reessayez dans 15 minutes.",
    };
  }
  const user = get<UserRow>("SELECT * FROM users WHERE email = ?", [identifier]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordAttempt(identifier, ip, false);
    run(
      "INSERT INTO audit_logs (id, actor_name, action, entity, details, ip, created_at) VALUES (?,?,?,?,?,?,?)",
      [newId(), identifier, "auth.login_failed", "session", "Mot de passe ou compte invalide", ip, nowIso()]
    );
    return { ok: false, error: "Identifiants incorrects." };
  }
  if (user.status !== "active") {
    recordAttempt(identifier, ip, false);
    return { ok: false, error: "Ce compte est desactive. Contactez votre administrateur." };
  }
  recordAttempt(identifier, ip, true);

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const headerBag = await headers();
  run(
    "INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, expires_at, created_at) VALUES (?,?,?,?,?,?,?)",
    [newId(), user.id, sha256(token), ip, headerBag.get("user-agent"), expiresAt, nowIso()]
  );
  run("UPDATE users SET last_login_at = ? WHERE id = ?", [nowIso(), user.id]);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });

  run(
    "INSERT INTO audit_logs (id, company_id, actor_id, actor_name, actor_role, action, entity, entity_id, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [newId(), user.company_id, user.id, user.name, user.role, "auth.login", "session", user.id, ip, nowIso()]
  );
  return { ok: true, userId: user.id };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    run("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?", [nowIso(), sha256(token)]);
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string) {
  run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [nowIso(), userId]);
}

export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "entreprise"
  );
}

export function uniqueCompanySlug(base: string): string {
  const slug = slugify(base);
  let candidate = slug;
  let index = 1;
  while (get("SELECT id FROM companies WHERE slug = ?", [candidate])) {
    index += 1;
    candidate = `${slug}-${index}`;
  }
  return candidate;
}

export type RegisterResult = { ok: true; companyId: string; userId: string } | { ok: false; error: string };

export async function registerCompany(input: {
  companyName: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
}): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  if (get("SELECT id FROM users WHERE email = ?", [email])) {
    return { ok: false, error: "Un compte existe deja avec cette adresse email." };
  }
  const companyId = newId();
  const userId = newId();
  const ts = nowIso();
  const slug = uniqueCompanySlug(input.companyName);

  run(
    `INSERT INTO companies (id, name, slug, email, phone, city, plan, subscription_status, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [companyId, input.companyName.trim(), slug, email, input.phone || null, input.city || null, "starter", "active", "active", ts, ts]
  );
  run(
    `INSERT INTO users (id, company_id, name, email, password_hash, role, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [userId, companyId, input.name.trim(), email, hashPassword(input.password), "owner", "active", ts, ts]
  );

  const defaults: Record<string, string> = {
    "ai.provider": "openai",
    "ai.model": "gpt-4o-mini",
    "ai.temperature": "0.7",
    "notifications.publication": "1",
    "notifications.campaign": "1",
    "notifications.team": "1",
    "privacy.policy": "1",
  };
  for (const [key, value] of Object.entries(defaults)) {
    run("INSERT INTO company_settings (company_id, key, value) VALUES (?,?,?)", [companyId, key, value]);
  }
  run(
    "INSERT INTO audit_logs (id, company_id, actor_id, actor_name, actor_role, action, entity, entity_id, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [newId(), companyId, userId, input.name, "owner", "company.created", "company", companyId, await clientIp(), ts]
  );
  return { ok: true, companyId, userId };
}

export async function createInvitation(input: {
  companyId: string;
  email: string;
  role: string;
  invitedBy: string;
}): Promise<{ id: string; token: string }> {
  const token = randomToken(24);
  const id = newId();
  run(
    `INSERT INTO invitations (id, company_id, email, role, token_hash, invited_by, expires_at, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      input.companyId,
      input.email.trim().toLowerCase(),
      input.role,
      sha256(token),
      input.invitedBy,
      new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      nowIso(),
    ]
  );
  return { id, token };
}

export async function acceptInvitation(input: {
  token: string;
  name: string;
  password: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const invitation = get<{ id: string; company_id: string; email: string; role: string; expires_at: string; accepted_at: string | null }>(
    "SELECT id, company_id, email, role, expires_at, accepted_at FROM invitations WHERE token_hash = ?",
    [sha256(input.token)]
  );
  if (!invitation || invitation.accepted_at) return { ok: false, error: "Invitation invalide ou deja utilisee." };
  if (new Date(invitation.expires_at).getTime() < Date.now()) return { ok: false, error: "Invitation expiree." };
  if (get("SELECT id FROM users WHERE email = ?", [invitation.email])) {
    return { ok: false, error: "Un compte existe deja avec cette adresse." };
  }
  const userId = newId();
  const ts = nowIso();
  run(
    `INSERT INTO users (id, company_id, name, email, password_hash, role, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [userId, invitation.company_id, input.name, invitation.email, hashPassword(input.password), invitation.role, "active", ts, ts]
  );
  run("UPDATE invitations SET accepted_at = ? WHERE id = ?", [ts, invitation.id]);
  run(
    "INSERT INTO notifications (id, company_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)",
    [newId(), invitation.company_id, "team", "Nouveau collaborateur", `${input.name} a rejoint l'espace.`, "/app/team", ts]
  );
  return { ok: true, userId };
}
