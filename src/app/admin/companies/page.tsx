import Link from "next/link";
import { SearchForm } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Badge, Card, CardHeader, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Entreprises" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  city: string | null;
  country: string | null;
  plan: string;
  subscription_status: string;
  subscription_renews_at: string | null;
  status: string;
  storage_quota_mb: number;
  created_at: string;
  members: number;
  contents: number;
  products: number;
  used_bytes: number;
};

const STATUS_TABS = [
  { id: "all", label: "Toutes" },
  { id: "active", label: "Actives" },
  { id: "suspended", label: "Suspendues" },
  { id: "archived", label: "Archivées" },
];

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; saved?: string; error?: string }>;
}) {
  await requirePlatformAdmin();
  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const status = STATUS_TABS.some((tab) => tab.id === query.status) ? query.status! : "all";

  const clauses: string[] = [];
  const params: string[] = [];
  if (q) {
    clauses.push("(c.name LIKE ? OR c.slug LIKE ? OR c.email LIKE ? OR c.city LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status !== "all") {
    clauses.push("c.status = ?");
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const companies = all<Row>(
    `SELECT c.id, c.name, c.slug, c.email, c.city, c.country, c.plan, c.subscription_status,
            c.subscription_renews_at, c.status, c.storage_quota_mb, c.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS members,
            (SELECT COUNT(*) FROM contents ct WHERE ct.company_id = c.id AND ct.archived_at IS NULL) AS contents,
            (SELECT COUNT(*) FROM products p WHERE p.company_id = c.id) AS products,
            (SELECT COALESCE(SUM(m.size_bytes), 0) FROM media m WHERE m.company_id = c.id) AS used_bytes
     FROM companies c ${where}
     ORDER BY c.created_at DESC LIMIT 200`,
    params
  );

  return (
    <>
      <PageHeader
        title="Entreprises clientes"
        subtitle="Abonnements, quotas de stockage et statut d'accès. Chaque intervention est journalisée."
        icon="building"
      />

      <Flash saved={query.saved} error={query.error} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          items={STATUS_TABS.map((tab) => ({
            label: tab.label,
            href: `/admin/companies?status=${tab.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            active: status === tab.id,
          }))}
        />
        <SearchForm action="/admin/companies" defaultValue={q} placeholder="Nom, slug, email, ville…" hidden={{ status }} />
      </div>

      <Card>
        <CardHeader
          title={`${formatNumber(companies.length)} entreprise(s)`}
          subtitle={`${formatNumber(companies.reduce((sum, company) => sum + Number(company.used_bytes), 0))} octets stockés au total`}
          icon="database"
        />
        {companies.length === 0 ? (
          <EmptyState icon="building" title="Aucun résultat" description="Ajustez la recherche ou le filtre de statut." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Localisation</th>
                  <th>Formule</th>
                  <th>Abonnement</th>
                  <th>Équipe</th>
                  <th>Activité</th>
                  <th>Stockage</th>
                  <th>Accès</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <Link href={`/admin/companies/${company.id}`} className="font-medium text-brand-800 hover:underline">
                        {company.name}
                      </Link>
                      <p className="text-[11px] text-ink-400">/{company.slug}</p>
                    </td>
                    <td className="text-[11.5px] text-ink-600">{[company.city, company.country].filter(Boolean).join(", ") || "—"}</td>
                    <td><Badge status="planned">{company.plan}</Badge></td>
                    <td>
                      <Badge status={company.subscription_status === "active" ? "active" : "pending"}>{company.subscription_status}</Badge>
                      <p className="text-[10.5px] text-ink-400">{company.subscription_renews_at ? formatDate(company.subscription_renews_at) : "—"}</p>
                    </td>
                    <td className="text-[11.5px] text-ink-600">{company.members}</td>
                    <td className="text-[11px] text-ink-500">
                      {company.contents} contenus<br />{company.products} produits
                    </td>
                    <td className="text-[11px] text-ink-500">
                      {formatBytes(Number(company.used_bytes))}<br />/ {company.storage_quota_mb} Mo
                    </td>
                    <td><Badge status={company.status === "active" ? "active" : "cancelled"}>{company.status}</Badge></td>
                    <td>
                      <Link href={`/admin/companies/${company.id}`} className="btn btn-sm">
                        <Icon name="eye" className="h-3.5 w-3.5" /> Ouvrir
                      </Link>
                    </td>
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
