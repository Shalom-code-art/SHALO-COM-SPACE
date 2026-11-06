import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignFormFields } from "@/app/app/campaigns/page";
import { ConfirmSubmit } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Badge, Card, CardHeader, Flash, InfoRow, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count, get } from "@/lib/db";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  CONTENT_STATUSES,
  PLATFORMS,
  formatDate,
  formatMoney,
  labelOf,
} from "@/lib/format";
import { deleteCampaignAction, setCampaignStatusAction, updateCampaignAction } from "@/server/actions/campaign";

export const metadata = { title: "Campagne" };

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser("campaign.view");
  const companyId = user.companyId!;
  const { id } = await params;
  const query = await searchParams;

  const campaign = get<Record<string, unknown>>(
    `SELECT c.*, u.name AS owner_name FROM campaigns c LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.id = ? AND c.company_id = ?`,
    [id, companyId]
  );
  if (!campaign) notFound();

  const members = all<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE company_id = ? AND status = 'active' ORDER BY name",
    [companyId]
  );
  const contents = all<{ id: string; title: string; type: string; status: string; scheduled_at: string | null }>(
    `SELECT id, title, type, status, scheduled_at FROM contents
     WHERE campaign_id = ? AND company_id = ? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 20`,
    [id, companyId]
  );
  const publishedCount = count(
    "SELECT COUNT(*) AS n FROM contents WHERE campaign_id = ? AND company_id = ? AND status = 'published'",
    [id, companyId]
  );
  const contactsGenerated = count(
    "SELECT COUNT(*) AS n FROM contacts WHERE company_id = ? AND kind = 'client' AND created_at >= ?",
    [companyId, String(campaign.start_date ?? "1970-01-01")]
  );
  let channels: string[] = [];
  try {
    channels = JSON.parse(String(campaign.channels ?? "[]"));
  } catch {
    channels = [];
  }

  return (
    <>
      <PageHeader
        title={String(campaign.name)}
        subtitle={`${labelOf(CAMPAIGN_TYPES, String(campaign.type))} · ${
          campaign.start_date ? formatDate(String(campaign.start_date)) : "début non défini"
        } → ${campaign.end_date ? formatDate(String(campaign.end_date)) : "fin non définie"}`}
        icon="megaphone"
        actions={
          <>
            <Link href="/app/campaigns" className="btn">
              <Icon name="arrow-right" className="h-4 w-4 rotate-180" /> Retour
            </Link>
            <Link href={`/app/ai?kind=campaign_ideas&brief=${encodeURIComponent(String(campaign.name))}`} className="btn">
              <Icon name="sparkles" className="h-4 w-4" /> Plan IA
            </Link>
            {user.permissions.includes("campaign.manage") ? (
              <form action={deleteCampaignAction}>
                <input type="hidden" name="id" value={id} />
                <ConfirmSubmit>Supprimer</ConfirmSubmit>
              </form>
            ) : null}
          </>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contenus associés" value={contents.length} icon="pen" tone="brand" />
        <StatCard label="Contenus publiés" value={publishedCount} icon="check-circle" tone="emerald" />
        <StatCard label="Budget prévisionnel" value={formatMoney(Number(campaign.budget_cents ?? 0), String(campaign.currency ?? "XAF"))} icon="chart" tone="accent" />
        <StatCard label="Objectif chiffré" value={Number(campaign.kpi_target ?? 0) || "—"} icon="star" tone="violet" hint="Contacts générés (période campagne)" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Fiche campagne" subtitle="Modifiez les informations et enregistrez" icon="megaphone" />
          {user.permissions.includes("campaign.manage") ? (
            <form action={updateCampaignAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="id" value={id} />
              <CampaignFormFields campaign={campaign} />
              <div className="md:col-span-2">
                <label className="label" htmlFor="ownerId">Responsable</label>
                <select id="ownerId" name="ownerId" defaultValue={String(campaign.owner_id ?? "")} className="input">
                  <option value="">Non affecté</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-1">
              <InfoRow label="Objectif" value={String(campaign.objective ?? "—")} />
              <InfoRow label="Public cible" value={String(campaign.audience ?? "—")} />
              <InfoRow label="Description" value={String(campaign.description ?? "—")} />
              <InfoRow label="Bilan" value={String(campaign.results_notes ?? "—")} />
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Statut de la campagne" subtitle="Faire évoluer l'état de diffusion" icon="clock" />
            <div className="mb-3">
              <Badge status={String(campaign.status)}>{labelOf(CAMPAIGN_STATUSES, String(campaign.status))}</Badge>
            </div>
            {user.permissions.includes("campaign.manage") ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CAMPAIGN_STATUSES)
                  .filter(([key]) => key !== campaign.status)
                  .map(([key, label]) => (
                    <form key={key} action={setCampaignStatusAction}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="status" value={key} />
                      <button type="submit" className="btn btn-sm">{label}</button>
                    </form>
                  ))}
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Informations" subtitle="Synthèse de la campagne" icon="file" />
            <InfoRow label="Responsable" value={String(campaign.owner_name ?? "Non affecté")} />
            <InfoRow label="Canaux" value={channels.length ? channels.map((channel) => labelOf(PLATFORMS, channel)).join(", ") : "Aucun"} />
            <InfoRow label="Contacts générés (depuis le début)" value={contactsGenerated} />
            <InfoRow label="Créée le" value={formatDate(String(campaign.created_at))} />
          </Card>
        </div>
      </div>

      <Card className="mt-3">
        <CardHeader
          title="Contenus associés"
          subtitle="Publications et supports rattachés à cette campagne"
          icon="pen"
          action={user.permissions.includes("content.create") ? <Link href="/app/content?new=1" className="btn btn-sm">Nouveau contenu</Link> : undefined}
        />
        {contents.length === 0 ? (
          <p className="text-[12px] text-ink-500">Aucun contenu rattaché. Associez un contenu à cette campagne depuis le studio.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Contenu</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Programmation</th>
                </tr>
              </thead>
              <tbody>
                {contents.map((content) => (
                  <tr key={content.id}>
                    <td>
                      <Link href={`/app/content/${content.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {content.title}
                      </Link>
                    </td>
                    <td className="text-[12px] text-ink-500">{content.type}</td>
                    <td><Badge status={content.status}>{labelOf(CONTENT_STATUSES, content.status)}</Badge></td>
                    <td className="text-[12px] text-ink-500">{content.scheduled_at ? formatDate(content.scheduled_at, true) : "—"}</td>
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
