import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, Flash, InfoRow, PageHeader, Progress, StatCard } from "@/components/ui";
import { clientIp, requirePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { all, count, get } from "@/lib/db";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { deleteCompanyAction, updateCompanyAction } from "@/server/actions/platform";

export const dynamic = "force-dynamic";

const PLANS = [
  { id: "starter", label: "Starter" },
  { id: "standard", label: "Standard" },
  { id: "premium", label: "Premium" },
  { id: "enterprise", label: "Entreprise" },
];

const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "suspended", "cancelled"];
const COMPANY_STATUSES = ["active", "suspended", "archived"];

export default async function AdminCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  const query = await searchParams;

  const company = get<Record<string, unknown>>("SELECT * FROM companies WHERE id = ?", [id]);
  if (!company) notFound();
  const companyId = String(company.id);

  const members = all<{ id: string; name: string; email: string; role: string; status: string; last_login_at: string | null; created_at: string }>(
    "SELECT id, name, email, role, status, last_login_at, created_at FROM users WHERE company_id = ? ORDER BY created_at",
    [companyId]
  );
  const usedBytes = Number(
    get<{ total: number }>("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM media WHERE company_id = ?", [companyId])?.total ?? 0
  );
  const quotaBytes = Number(company.storage_quota_mb ?? 0) * 1024 * 1024;
  const usagePercent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  const stats = {
    contents: count("SELECT COUNT(*) AS n FROM contents WHERE company_id = ? AND archived_at IS NULL", [companyId]),
    campaigns: count("SELECT COUNT(*) AS n FROM campaigns WHERE company_id = ?", [companyId]),
    contacts: count("SELECT COUNT(*) AS n FROM contacts WHERE company_id = ?", [companyId]),
    products: count("SELECT COUNT(*) AS n FROM products WHERE company_id = ?", [companyId]),
    media: count("SELECT COUNT(*) AS n FROM media WHERE company_id = ?", [companyId]),
    tasks: count("SELECT COUNT(*) AS n FROM tasks WHERE company_id = ? AND status <> 'done'", [companyId]),
  };

  const auditLogs = all<{ id: string; actor_name: string | null; actor_role: string | null; action: string; entity: string; details: string | null; ip: string | null; created_at: string }>(
    `SELECT id, actor_name, actor_role, action, entity, details, ip, created_at
     FROM audit_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 40`,
    [companyId]
  );

  const deletionRequested = Boolean(
    get("SELECT id FROM audit_logs WHERE company_id = ? AND action = 'company.deletion_requested' LIMIT 1", [companyId])
  );

  // Toute consultation d'une fiche client est tracee (aucun contenu prive n'est expose ici).
  logAudit({
    companyId,
    actor: admin,
    action: "platform.company_inspected",
    entity: "company",
    entityId: companyId,
    details: "Consultation de la fiche entreprise (metadonnees et abonnement)",
    ip: await clientIp(),
  });

  const value = (key: string) => String(company[key] ?? "");

  return (
    <>
      <PageHeader
        title={value("name")}
        subtitle={`Espace ${value("slug")} · créé le ${formatDate(value("created_at"))} · ${members.length} membre(s)`}
        icon="building"
        actions={
          <Link href="/admin/companies" className="btn">
            <Icon name="arrow-right" className="h-4 w-4 rotate-180" /> Retour
          </Link>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      {deletionRequested ? (
        <Alert tone="error" title="Demande de suppression reçue">
          L&apos;entreprise a demandé la suppression de ses données. Vérifiez la demande avec le client avant toute
          suppression définitive (zone dédiée en bas de page).
        </Alert>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contenus" value={formatNumber(stats.contents)} icon="pen" />
        <StatCard label="Campagnes" value={formatNumber(stats.campaigns)} icon="megaphone" tone="accent" />
        <StatCard label="Contacts" value={formatNumber(stats.contacts)} icon="users" tone="violet" />
        <StatCard label="Produits & services" value={formatNumber(stats.products)} icon="store" tone="emerald" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Abonnement & accès" subtitle="Modifier la formule, le statut et le quota de stockage" icon="settings" />
          <form action={updateCompanyAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="companyId" value={companyId} />
            <div>
              <label className="label" htmlFor="plan">Formule</label>
              <select id="plan" name="plan" className="input" defaultValue={value("plan")}>
                {PLANS.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="subscriptionStatus">Statut d&apos;abonnement</label>
              <select id="subscriptionStatus" name="subscriptionStatus" className="input" defaultValue={value("subscription_status")}>
                {SUBSCRIPTION_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">Accès à l&apos;espace</label>
              <select id="status" name="status" className="input" defaultValue={value("status")}>
                {COMPANY_STATUSES.map((status) => (
                  <option key={status} value={status}>{status === "active" ? "Actif" : status === "suspended" ? "Suspendu" : "Archivé"}</option>
                ))}
              </select>
              <p className="hint">Toute suspension révoque immédiatement les sessions ouvertes.</p>
            </div>
            <div>
              <label className="label" htmlFor="storageQuotaMb">Quota de stockage (Mo)</label>
              <input
                id="storageQuotaMb"
                name="storageQuotaMb"
                type="number"
                min={64}
                max={512000}
                step={64}
                defaultValue={Number(company.storage_quota_mb ?? 2048)}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="renewsAt">Prochain renouvellement</label>
              <input
                id="renewsAt"
                name="renewsAt"
                type="date"
                defaultValue={value("subscription_renews_at") ? value("subscription_renews_at").slice(0, 10) : ""}
                className="input"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="btn btn-primary">
                <Icon name="check" className="h-4 w-4" /> Enregistrer
              </button>
            </div>
          </form>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Fiche entreprise" icon="building" />
            <InfoRow label="Raison sociale" value={value("legal_name") || "—"} />
            <InfoRow label="Email" value={value("email") || "—"} />
            <InfoRow label="Téléphone" value={value("phone") || "—"} />
            <InfoRow label="Adresse" value={[value("address"), value("city"), value("country")].filter(Boolean).join(", ") || "—"} />
            <InfoRow label="Site web" value={value("website") || "—"} />
            <InfoRow label="Vitrine" value={value("shop_enabled") === "1" ? "Activée" : "Désactivée"} />
            {value("slug") ? (
              <div className="mt-2">
                <Link href={`/boutique/${value("slug")}`} target="_blank" className="btn btn-sm">
                  <Icon name="external" className="h-3.5 w-3.5" /> Voir la vitrine publique
                </Link>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Stockage" icon="database" />
            <InfoRow label="Fichiers" value={formatNumber(stats.media)} />
            <InfoRow label="Utilisé" value={`${formatBytes(usedBytes)} / ${Number(company.storage_quota_mb ?? 0)} Mo`} />
            <div className="mt-2">
              <Progress value={usagePercent} tone={usagePercent > 85 ? "rose" : "brand"} />
              <p className="hint">{usagePercent} % du quota consommé</p>
            </div>
            <InfoRow label="Tâches ouvertes" value={formatNumber(stats.tasks)} />
          </Card>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Membres" subtitle="Comptes rattachés à l'entreprise" icon="users" />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Dernière connexion</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <p className="font-medium text-ink-800">{member.name}</p>
                      <p className="text-[11px] text-ink-400">{member.email}</p>
                    </td>
                    <td><Badge status={member.role === "owner" ? "admin" : "planned"}>{ROLE_LABELS[member.role as Role] ?? member.role}</Badge></td>
                    <td><Badge status={member.status === "active" ? "active" : "cancelled"}>{member.status}</Badge></td>
                    <td className="text-[11px] text-ink-500">{member.last_login_at ? formatDateTime(member.last_login_at) : "jamais"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Journal de l'entreprise" subtitle="40 dernières opérations" icon="clock" />
          <div className="table-wrap max-h-[420px] overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Acteur</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <p className="font-medium text-ink-800">{entry.action}</p>
                      {entry.details ? <p className="text-[11px] text-ink-500">{entry.details}</p> : null}
                    </td>
                    <td className="text-[11px] text-ink-600">{entry.actor_name ?? "Système"}<br /><span className="text-ink-400">{entry.actor_role ?? ""}</span></td>
                    <td className="text-[11px] text-ink-500">{formatDateTime(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-3 border-rose-200">
        <CardHeader
          title="Zone sensible"
          subtitle="Suppression définitive de l'entreprise et de toutes ses données"
          icon="alert"
        />
        <Alert tone="error" title="Action irréversible">
          La suppression efface l&apos;entreprise, ses utilisateurs, contenus, contacts, fichiers, catalogues et journaux.
          N&apos;exécutez cette action qu&apos;après vérification écrite de la demande du client.
        </Alert>
        <form action={deleteCompanyAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="companyId" value={companyId} />
          <div>
            <label className="label" htmlFor="confirm">Recopiez « {value("name")} » pour confirmer</label>
            <input id="confirm" name="confirm" required autoComplete="off" className="input" />
          </div>
          <ConfirmSubmit message="Supprimer définitivement cette entreprise ?">Supprimer l&apos;entreprise</ConfirmSubmit>
        </form>
      </Card>
    </>
  );
}
