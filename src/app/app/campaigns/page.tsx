import Link from "next/link";
import { ConfirmSubmit, Disclosure } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, PLATFORMS, formatDate, formatMoney, labelOf } from "@/lib/format";
import { createCampaignAction, deleteCampaignAction } from "@/server/actions/campaign";

export const metadata = { title: "Campagnes marketing" };

export function CampaignFormFields({ campaign }: { campaign?: Record<string, unknown> }) {
  const channels = String(campaign?.channels ?? "[]");
  return (
    <>
      <div className="md:col-span-2">
        <label className="label" htmlFor="name">Nom de la campagne *</label>
        <input id="name" name="name" required defaultValue={String(campaign?.name ?? "")} className="input" placeholder="Ex. Lancement offre de fin d'année" />
      </div>
      <div>
        <label className="label" htmlFor="type">Type</label>
        <select id="type" name="type" defaultValue={String(campaign?.type ?? "promotion")} className="input">
          {Object.entries(CAMPAIGN_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="status">Statut</label>
        <select id="status" name="status" defaultValue={String(campaign?.status ?? "planned")} className="input">
          {Object.entries(CAMPAIGN_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="objective">Objectif</label>
        <input id="objective" name="objective" defaultValue={String(campaign?.objective ?? "")} className="input" placeholder="Ex. Générer 150 demandes de devis" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="audience">Public cible</label>
        <input id="audience" name="audience" defaultValue={String(campaign?.audience ?? "")} className="input" placeholder="Ex. PME de Libreville, décideurs 30-55 ans" />
      </div>
      <div>
        <label className="label" htmlFor="startDate">Date de début</label>
        <input id="startDate" name="startDate" type="date" defaultValue={toDate(campaign?.start_date)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="endDate">Date de fin</label>
        <input id="endDate" name="endDate" type="date" defaultValue={toDate(campaign?.end_date)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="budget">Budget prévisionnel</label>
        <input id="budget" name="budget" type="number" min="0" step="0.01" defaultValue={String(Number(campaign?.budget_cents ?? 0) / 100)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="currency">Devise</label>
        <select id="currency" name="currency" defaultValue={String(campaign?.currency ?? "XAF")} className="input">
          <option value="XAF">XAF</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="XOF">XOF</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="kpiTarget">Objectif chiffré (indicateur clé)</label>
        <input id="kpiTarget" name="kpiTarget" type="number" min="0" defaultValue={String(campaign?.kpi_target ?? 0)} className="input" />
        <p className="hint">Ex. nombre de contacts générés ou de ventes visées.</p>
      </div>
      <div className="md:col-span-2">
        <p className="label">Canaux de diffusion</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PLATFORMS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-2 py-1 text-[11.5px] text-ink-700">
              <input type="checkbox" name="channels" value={key} defaultChecked={channels.includes(`"${key}"`)} className="h-3.5 w-3.5" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} defaultValue={String(campaign?.description ?? "")} className="input" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="resultsNotes">Résultats / bilan</label>
        <textarea id="resultsNotes" name="resultsNotes" rows={3} defaultValue={String(campaign?.results_notes ?? "")} className="input" placeholder="Renseignez le bilan au fur et à mesure : retours, chiffres réels, enseignements." />
        <p className="hint">Les chiffres saisis ici sont vos données réelles ; aucun résultat n'est généré automatiquement.</p>
      </div>
    </>
  );
}

function toDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("campaign.view");
  const companyId = user.companyId!;
  const query = await searchParams;

  const where = ["c.company_id = ?"];
  const args: unknown[] = [companyId];
  if (query.status && query.status !== "all") {
    where.push("c.status = ?");
    args.push(query.status);
  }

  const campaigns = all<{
    id: string;
    name: string;
    type: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    budget_cents: number;
    currency: string;
    channels: string | null;
    owner: string | null;
    contents: number;
  }>(
    `SELECT c.id, c.name, c.type, c.status, c.start_date, c.end_date, c.budget_cents, c.currency, c.channels,
            u.name AS owner,
            (SELECT COUNT(*) FROM contents ct WHERE ct.campaign_id = c.id) AS contents
     FROM campaigns c LEFT JOIN users u ON u.id = c.owner_id
     WHERE ${where.join(" AND ")}
     ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, c.start_date DESC`,
    args
  );

  const counts = all<{ status: string; total: number }>(
    "SELECT status, COUNT(*) AS total FROM campaigns WHERE company_id = ? GROUP BY status",
    [companyId]
  );
  const total = counts.reduce((sum, row) => sum + Number(row.total), 0);
  const members = all<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE company_id = ? AND status = 'active' ORDER BY name",
    [companyId]
  );

  return (
    <>
      <PageHeader
        title="Campagnes marketing"
        subtitle="Pilotez objectifs, budgets, canaux, contenus associés et résultats de vos campagnes."
        icon="megaphone"
        actions={
          <Link href="/app/ai?kind=campaign_ideas" className="btn">
            <Icon name="sparkles" className="h-4 w-4" /> Idées avec l'IA
          </Link>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <Tabs
        items={[
          { label: "Toutes", href: "/app/campaigns", active: !query.status || query.status === "all", count: total },
          ...Object.entries(CAMPAIGN_STATUSES).map(([key, label]) => ({
            label,
            href: `/app/campaigns?status=${key}`,
            active: query.status === key,
            count: Number(counts.find((row) => row.status === key)?.total ?? 0),
          })),
        ]}
      />

      {user.permissions.includes("campaign.manage") ? (
        <div className="mb-4">
          <Disclosure title="Nouvelle campagne">
            <form action={createCampaignAction} className="card card-pad grid gap-3 md:grid-cols-2">
              <CampaignFormFields />
              <div className="md:col-span-2">
                <label className="label" htmlFor="ownerId">Responsable</label>
                <select id="ownerId" name="ownerId" className="input" defaultValue={user.id}>
                  <option value="">Non affecté</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Créer la campagne
                </button>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon="megaphone"
            title="Aucune campagne"
            description="Créez une campagne pour organiser vos contenus, vos canaux et vos résultats dans une même fiche."
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {campaigns.map((campaign) => {
            let channels: string[] = [];
            try {
              channels = JSON.parse(campaign.channels || "[]");
            } catch {
              channels = [];
            }
            return (
              <Card key={campaign.id} className="animate-rise">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/app/campaigns/${campaign.id}`} className="block truncate text-[14px] font-semibold text-ink-900 hover:text-brand-700">
                      {campaign.name}
                    </Link>
                    <p className="text-[11.5px] text-ink-500">{labelOf(CAMPAIGN_TYPES, campaign.type)}</p>
                  </div>
                  <Badge status={campaign.status}>{labelOf(CAMPAIGN_STATUSES, campaign.status)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-ink-50 px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Période</p>
                    <p className="text-[11px] font-medium text-ink-800">
                      {campaign.start_date ? formatDate(campaign.start_date) : "—"}
                    </p>
                    <p className="text-[10px] text-ink-400">{campaign.end_date ? formatDate(campaign.end_date) : "non définie"}</p>
                  </div>
                  <div className="rounded-xl bg-ink-50 px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Budget</p>
                    <p className="text-[12px] font-semibold text-ink-900">{formatMoney(campaign.budget_cents, campaign.currency)}</p>
                  </div>
                  <div className="rounded-xl bg-ink-50 px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-ink-400">Contenus</p>
                    <p className="text-[12px] font-semibold text-ink-900">{campaign.contents}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {channels.length === 0 ? (
                    <span className="text-[10.5px] text-ink-400">Aucun canal défini</span>
                  ) : (
                    channels.map((channel) => (
                      <span key={channel} className="badge border-ink-200 bg-white text-ink-600">
                        {labelOf(PLATFORMS, channel)}
                      </span>
                    ))
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2">
                  <p className="text-[11px] text-ink-500">Responsable : {campaign.owner ?? "non affecté"}</p>
                  <div className="flex items-center gap-1">
                    <Link href={`/app/campaigns/${campaign.id}`} className="btn btn-sm btn-ghost">
                      <Icon name="pen" className="h-3.5 w-3.5" /> Ouvrir
                    </Link>
                    {user.permissions.includes("campaign.manage") ? (
                      <form action={deleteCampaignAction}>
                        <input type="hidden" name="id" value={campaign.id} />
                        <ConfirmSubmit />
                      </form>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
