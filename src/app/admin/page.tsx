import Link from "next/link";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { all, count } from "@/lib/db";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";

export const metadata = { title: "Console plateforme" };
export const dynamic = "force-dynamic";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
  status: string;
  storage_quota_mb: number;
  subscription_renews_at: string | null;
  created_at: string;
  members: number;
  used_bytes: number;
};

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();

  const companies = all<CompanyRow>(
    `SELECT c.id, c.name, c.slug, c.plan, c.subscription_status, c.status, c.storage_quota_mb,
            c.subscription_renews_at, c.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS members,
            (SELECT COALESCE(SUM(m.size_bytes), 0) FROM media m WHERE m.company_id = c.id) AS used_bytes
     FROM companies c ORDER BY c.created_at DESC`
  );

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((company) => company.status === "active").length;
  const suspendedCompanies = companies.filter((company) => company.status !== "active").length;
  const totalUsers = count("SELECT COUNT(*) AS n FROM users");
  const totalContents = count("SELECT COUNT(*) AS n FROM contents WHERE archived_at IS NULL");
  const totalProducts = count("SELECT COUNT(*) AS n FROM products");
  const usedBytes = companies.reduce((sum, company) => sum + Number(company.used_bytes ?? 0), 0);

  const renewals = companies
    .filter((company) => company.subscription_renews_at)
    .filter((company) => {
      const diff = new Date(company.subscription_renews_at!).getTime() - Date.now();
      return diff > 0 && diff < 30 * 86400000;
    })
    .sort((a, b) => String(a.subscription_renews_at).localeCompare(String(b.subscription_renews_at)));

  const deletionRequests = all<{ company_id: string | null; details: string | null; created_at: string; actor_name: string | null; name: string | null }>(
    `SELECT a.company_id, a.details, a.created_at, a.actor_name, c.name
     FROM audit_logs a LEFT JOIN companies c ON c.id = a.company_id
     WHERE a.action = 'company.deletion_requested' ORDER BY a.created_at DESC LIMIT 8`
  );

  const recentAudit = all<{ id: string; company: string | null; actor_name: string | null; action: string; details: string | null; created_at: string }>(
    `SELECT a.id, c.name AS company, a.actor_name, a.action, a.details, a.created_at
     FROM audit_logs a LEFT JOIN companies c ON c.id = a.company_id
     ORDER BY a.created_at DESC LIMIT 14`
  );

  return (
    <>
      <PageHeader
        title="Vue d'ensemble de la plateforme"
        subtitle="Entreprises clientes, abonnements, volumes stockés et activité d'administration BATIANA TECH."
        icon="shield"
        actions={
          <Link href="/admin/companies" className="btn btn-primary">
            <Icon name="building" className="h-4 w-4" /> Gérer les entreprises
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entreprises" value={totalCompanies} icon="building" hint={`${activeCompanies} actives`} />
        <StatCard label="Comptes utilisateurs" value={formatNumber(totalUsers)} icon="users" tone="violet" />
        <StatCard label="Contenus" value={formatNumber(totalContents)} icon="pen" tone="emerald" hint={`${formatNumber(totalProducts)} produits / services`} />
        <StatCard label="Stockage médiathèques" value={formatBytes(usedBytes)} icon="database" tone="accent" hint="Toutes entreprises" />
      </div>

      {suspendedCompanies > 0 || renewals.length > 0 || deletionRequests.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {deletionRequests.length > 0 ? (
            <Alert tone="error" title="Demandes de suppression en attente">
              {deletionRequests.map((request) => (
                <p key={`${request.company_id}-${request.created_at}`}>
                  {request.name ?? "Entreprise supprimée"} · demandé par {request.actor_name ?? "—"} le {formatDateTime(request.created_at)}
                  {request.company_id ? (
                    <Link href={`/admin/companies/${request.company_id}`} className="ml-2 font-semibold underline">
                      Traiter
                    </Link>
                  ) : null}
                </p>
              ))}
            </Alert>
          ) : null}
          {suspendedCompanies > 0 ? (
            <Alert tone="warning" title={`${suspendedCompanies} entreprise(s) suspendue(s) ou archivée(s)`}>
              Ces espaces ne peuvent plus être utilisés par leurs membres. Vérifiez les motifs avant réactivation.
            </Alert>
          ) : null}
          {renewals.length > 0 ? (
            <Alert tone="info" title="Abonnements à renouveler sous 30 jours">
              {renewals.slice(0, 4).map((company) => (
                <p key={company.id}>
                  {company.name} · {formatDateTime(company.subscription_renews_at)}
                </p>
              ))}
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Entreprises récentes"
            subtitle="Volumes et abonnements déclarés"
            icon="building"
            action={
              <Link href="/admin/companies" className="btn btn-sm">
                Tout voir
              </Link>
            }
          />
          {companies.length === 0 ? (
            <EmptyState icon="building" title="Aucune entreprise" description="Les inscriptions créées depuis la page publique apparaîtront ici." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Entreprise</th>
                    <th>Formule</th>
                    <th>Membres</th>
                    <th>Stockage</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.slice(0, 8).map((company) => (
                    <tr key={company.id}>
                      <td>
                        <Link href={`/admin/companies/${company.id}`} className="font-medium text-brand-800 hover:underline">
                          {company.name}
                        </Link>
                        <p className="text-[11px] text-ink-400">/{company.slug}</p>
                      </td>
                      <td><Badge status="planned">{company.plan}</Badge></td>
                      <td className="text-[11.5px] text-ink-600">{company.members}</td>
                      <td className="text-[11px] text-ink-500">
                        {formatBytes(Number(company.used_bytes))} / {company.storage_quota_mb} Mo
                      </td>
                      <td><Badge status={company.status === "active" ? "active" : "cancelled"}>{company.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Activité récente" subtitle="Journal d'audit toutes entreprises" icon="clock" />
          {recentAudit.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucune activité enregistrée.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentAudit.map((entry) => (
                <li key={entry.id} className="py-2">
                  <p className="text-[12px] font-medium text-ink-800">{entry.action}</p>
                  <p className="text-[11px] text-ink-500">
                    {entry.company ?? "Plateforme"} · {entry.actor_name ?? "Système"} · {formatDateTime(entry.created_at)}
                  </p>
                  {entry.details ? <p className="text-[11px] text-ink-400">{entry.details}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
