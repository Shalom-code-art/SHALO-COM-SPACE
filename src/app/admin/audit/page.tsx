import Link from "next/link";
import { SearchForm } from "@/components/controls";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";

export const metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  company_id: string | null;
  company: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  details: string | null;
  ip: string | null;
  created_at: string;
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const query = await searchParams;
  const q = (query.q ?? "").trim();

  const logs = q
    ? all<Row>(
        `SELECT a.id, a.company_id, c.name AS company, a.actor_name, a.actor_role, a.action, a.entity, a.details, a.ip, a.created_at
         FROM audit_logs a LEFT JOIN companies c ON c.id = a.company_id
         WHERE a.action LIKE ? OR a.details LIKE ? OR a.actor_name LIKE ? OR c.name LIKE ?
         ORDER BY a.created_at DESC LIMIT 300`,
        [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
      )
    : all<Row>(
        `SELECT a.id, a.company_id, c.name AS company, a.actor_name, a.actor_role, a.action, a.entity, a.details, a.ip, a.created_at
         FROM audit_logs a LEFT JOIN companies c ON c.id = a.company_id
         ORDER BY a.created_at DESC LIMIT 300`
      );

  return (
    <>
      <PageHeader
        title="Journal d'audit de la plateforme"
        subtitle="300 dernières opérations, toutes entreprises confondues. Les traces ne peuvent pas être modifiées depuis l'interface."
        icon="shield"
        actions={<SearchForm action="/admin/audit" defaultValue={q} placeholder="Action, acteur, entreprise…" />}
      />

      <Card>
        <CardHeader title={`${formatNumber(logs.length)} entrée(s)`} subtitle="Ordre chronologique inverse" icon="clock" />
        {logs.length === 0 ? (
          <EmptyState icon="shield" title="Aucune entrée" description="Aucune opération ne correspond à ce filtre." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entreprise</th>
                  <th>Acteur</th>
                  <th>Action</th>
                  <th>Détails</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap text-[11px] text-ink-500">{formatDateTime(entry.created_at)}</td>
                    <td className="text-[11.5px] text-ink-700">
                      {entry.company_id ? (
                        <Link href={`/admin/companies/${entry.company_id}`} className="hover:underline">
                          {entry.company ?? "—"}
                        </Link>
                      ) : (
                        "Plateforme"
                      )}
                    </td>
                    <td className="text-[11px] text-ink-600">
                      {entry.actor_name ?? "Système"}
                      <span className="block text-ink-400">{entry.actor_role ?? ""}</span>
                    </td>
                    <td className="text-[11.5px] font-medium text-ink-800">{entry.action}</td>
                    <td className="max-w-[380px] text-[11px] text-ink-500">{entry.details ?? "—"}</td>
                    <td className="text-[10.5px] text-ink-400">{entry.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
