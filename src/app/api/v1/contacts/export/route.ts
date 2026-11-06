import type { NextRequest } from "next/server";
import { clientIp, requireApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { all } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type ClientRow = {
  name: string;
  company_name: string | null;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  tags: string | null;
  consent_email: number;
  consent_whatsapp: number;
  consent_source: string | null;
  notes: string | null;
  created_at: string;
};

type EmployeeRow = {
  name: string;
  job_title: string | null;
  department: string | null;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") === "employee" ? "employee" : "client";
  const permission = kind === "employee" ? "contacts.employees.view" : "contacts.clients.view";
  const user = await requireApiUser(permission);
  if (!user || !user.companyId) {
    return new Response("Accès refusé : authentification requise.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const companyId = user.companyId;

  const csv =
    kind === "employee"
      ? toCsv<EmployeeRow>(
          all<EmployeeRow>(
            `SELECT name, job_title, department, manager_name, phone, email, notes, created_at
             FROM contacts WHERE company_id = ? AND kind = 'employee' ORDER BY department, name`,
            [companyId]
          ),
          [
            { key: "name", label: "nom" },
            { key: "job_title", label: "fonction" },
            { key: "department", label: "service" },
            { key: "manager_name", label: "responsable" },
            { key: "phone", label: "telephone" },
            { key: "email", label: "email" },
            { key: "notes", label: "notes" },
            { key: "created_at", label: "cree_le" },
          ]
        )
      : toCsv<ClientRow>(
          all<ClientRow>(
            `SELECT name, company_name, category, phone, whatsapp, email, tags,
                    consent_email, consent_whatsapp, consent_source, notes, created_at
             FROM contacts WHERE company_id = ? AND kind = 'client' ORDER BY name`,
            [companyId]
          ),
          [
            { key: "name", label: "nom" },
            { key: "company_name", label: "entreprise" },
            { key: "category", label: "categorie" },
            { key: "phone", label: "telephone" },
            { key: "whatsapp", label: "whatsapp" },
            { key: "email", label: "email" },
            { key: "tags", label: "tags" },
            { key: "consent_email", label: "consentement_email", get: (row) => (row.consent_email ? "oui" : "non") },
            { key: "consent_whatsapp", label: "consentement_whatsapp", get: (row) => (row.consent_whatsapp ? "oui" : "non") },
            { key: "consent_source", label: "origine_consentement" },
            { key: "notes", label: "notes" },
            { key: "created_at", label: "cree_le" },
          ]
        );

  const filename = kind === "employee" ? `collaborateurs-${today()}.csv` : `contacts-clients-${today()}.csv`;
  logAudit({
    companyId,
    actor: user,
    action: "contacts.exported",
    entity: "contact",
    details: `kind=${kind}`,
    ip: await clientIp(),
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
