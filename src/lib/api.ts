import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, nowIso, run } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { effectivePermissions, hasPermission, type Permission, type Role } from "@/lib/permissions";

/**
 * Authentification de l'API v1.
 * Deux modes sont acceptes :
 *  - cle API `Authorization: Bearer shalo_...` (hache SHA-256 en base, jamais de clair stocke) ;
 *  - session navigateur (cookies) pour les exports appeles depuis l'interface.
 * Les cles API agissent avec les droits du proprietaire de l'entreprise,
 * sans la permission plateforme.
 */

export type ApiActor = { id: string; name: string; role: Role | "api_key" };

export type ApiIdentity = {
  companyId: string;
  actor: ApiActor;
  permissions: Permission[];
  via: "session" | "api_key";
  keyId?: string;
};

export type ApiAuthFailure = { ok: false; status: 401 | 403; code: string; message: string };
export type ApiAuthSuccess = { ok: true; identity: ApiIdentity };

export const API_KEY_PERMISSIONS: Permission[] = effectivePermissions("owner").filter(
  (permission) => permission !== "platform.manage"
);

export async function authenticateApi(
  required?: Permission | Permission[]
): Promise<ApiAuthSuccess | ApiAuthFailure> {
  const headerBag = await headers();
  const authorization = headerBag.get("authorization") ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token.startsWith("shalo_")) {
      const row = get<{ id: string; name: string; company_id: string; revoked_at: string | null; company_status: string }>(
        `SELECT k.id, k.name, k.company_id, k.revoked_at, c.status AS company_status
         FROM api_keys k JOIN companies c ON c.id = k.company_id
         WHERE k.key_hash = ?`,
        [sha256(token)]
      );
      if (!row || row.revoked_at) {
        return { ok: false, status: 401, code: "invalid_key", message: "Clé API invalide ou révoquée." };
      }
      if (row.company_status !== "active") {
        return { ok: false, status: 403, code: "company_inactive", message: "L'espace de cette entreprise n'est pas actif." };
      }
      if (required && !hasPermission(API_KEY_PERMISSIONS, required)) {
        return { ok: false, status: 403, code: "forbidden", message: "Permission insuffisante pour cette ressource." };
      }
      run("UPDATE api_keys SET last_used_at = ? WHERE id = ?", [nowIso(), row.id]);
      return {
        ok: true,
        identity: {
          companyId: row.company_id,
          actor: { id: row.id, name: `Clé API ${row.name}`, role: "api_key" },
          permissions: API_KEY_PERMISSIONS,
          via: "api_key",
          keyId: row.id,
        },
      };
    }
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, code: "unauthenticated", message: "Authentification requise." };
  if (!user.companyId || !user.company) {
    return { ok: false, status: 403, code: "no_company", message: "Cette ressource est réservée aux espaces entreprise." };
  }
  if (user.company.status !== "active") {
    return { ok: false, status: 403, code: "company_inactive", message: "L'espace de cette entreprise n'est pas actif." };
  }
  if (required && !hasPermission(user.permissions, required)) {
    return { ok: false, status: 403, code: "forbidden", message: "Permission insuffisante pour cette ressource." };
  }
  return {
    ok: true,
    identity: {
      companyId: user.companyId,
      actor: { id: user.id, name: user.name, role: user.role },
      permissions: user.permissions,
      via: "session",
    },
  };
}

export function apiJson(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function apiError(status: number, code: string, message: string) {
  return apiJson({ error: { code, message } }, { status });
}

/** Pagination simple et bornee pour toutes les listes de l'API. */
export function pagination(request: NextRequest, defaultLimit = 25) {
  const params = request.nextUrl.searchParams;
  const rawLimit = Number(params.get("limit") ?? defaultLimit);
  const rawOffset = Number(params.get("offset") ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.round(rawLimit))) : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.round(rawOffset)) : 0;
  return { limit, offset };
}

/** Construit un filtre LIKE securise (parametre lie, pas d'interpolation). */
export function likeTerm(value: string | null): string {
  return `%${(value ?? "").trim()}%`;
}

export function readParam(request: NextRequest, name: string): string {
  return (request.nextUrl.searchParams.get(name) ?? "").trim();
}
