import type { NextRequest } from "next/server";
import { apiError, apiJson, authenticateApi, likeTerm, pagination, readParam } from "@/lib/api";
import { all, count } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liste paginee des contacts d'un type donne (client | employee).
 * Les deux annuaires restent strictement separes.
 */
export async function GET(request: NextRequest) {
  const kind = readParam(request, "kind") === "employee" ? "employee" : "client";
  const permission = kind === "employee" ? "contacts.employees.view" : "contacts.clients.view";
  const auth = await authenticateApi(permission);
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { companyId } = auth.identity;
  const { limit, offset } = pagination(request);

  const q = readParam(request, "q");
  const category = readParam(request, "category");
  const department = readParam(request, "department");

  const clauses = ["company_id = ?", "kind = ?"];
  const params: unknown[] = [companyId, kind];
  if (q) {
    clauses.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR whatsapp LIKE ? OR company_name LIKE ? OR job_title LIKE ?)");
    params.push(likeTerm(q), likeTerm(q), likeTerm(q), likeTerm(q), likeTerm(q), likeTerm(q));
  }
  if (kind === "client" && category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (kind === "employee" && department) {
    clauses.push("department = ?");
    params.push(department);
  }
  const where = clauses.join(" AND ");

  const total = count(`SELECT COUNT(*) AS n FROM contacts WHERE ${where}`, params);
  const items = all(
    `SELECT id, kind, name, phone, whatsapp, email, company_name, category, job_title, department,
            manager_name, tags, consent_email, consent_whatsapp, consent_source, created_at, updated_at
     FROM contacts WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return apiJson({ data: items, pagination: { total, limit, offset } });
}
