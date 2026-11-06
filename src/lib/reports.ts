import { all, count } from "@/lib/db";
import { formatDate } from "@/lib/format";

/**
 * Agregation des indicateurs (Module 10).
 * Toutes les valeurs proviennent de la base. Quand aucune source connectee
 * n'existe, les agregats restent a zero et l'interface l'indique explicitement.
 */

export type Period = {
  from: string; // YYYY-MM-DD
  to: string;
  fromIso: string;
  toIso: string;
  prevFromIso: string;
  prevToIso: string;
  label: string;
};

export function resolvePeriod(from?: string | null, to?: string | null): Period {
  const today = new Date();
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
  const defaultStart = new Date(end.getTime() - 29 * 86400000);
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.UTC(defaultStart.getUTCFullYear(), defaultStart.getUTCMonth(), defaultStart.getUTCDate()));
  const span = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    fromIso: start.toISOString(),
    toIso: end.toISOString(),
    prevFromIso: prevStart.toISOString(),
    prevToIso: prevEnd.toISOString(),
    label: `${formatDate(start.toISOString())} → ${formatDate(end.toISOString())}`,
  };
}

type Totals = {
  contentsCreated: number;
  contentsPublished: number;
  contentsScheduled: number;
  contactsAdded: number;
  interactions: number;
  campaignsActive: number;
  tasksCompleted: number;
  publications: number;
  reach: number;
  impressions: number;
  engagement: number;
};

function totalsFor(companyId: string, fromIso: string, toIso: string): Totals {
  return {
    contentsCreated: count(
      "SELECT COUNT(*) AS n FROM contents WHERE company_id = ? AND created_at BETWEEN ? AND ? AND archived_at IS NULL",
      [companyId, fromIso, toIso]
    ),
    contentsPublished: count(
      "SELECT COUNT(*) AS n FROM contents WHERE company_id = ? AND status = 'published' AND published_at BETWEEN ? AND ?",
      [companyId, fromIso, toIso]
    ),
    contentsScheduled: count(
      "SELECT COUNT(*) AS n FROM contents WHERE company_id = ? AND status IN ('scheduled','approved') AND scheduled_at BETWEEN ? AND ?",
      [companyId, fromIso, toIso]
    ),
    contactsAdded: count(
      "SELECT COUNT(*) AS n FROM contacts WHERE company_id = ? AND kind = 'client' AND created_at BETWEEN ? AND ?",
      [companyId, fromIso, toIso]
    ),
    interactions: count(
      "SELECT COUNT(*) AS n FROM contact_interactions WHERE company_id = ? AND occurred_at BETWEEN ? AND ?",
      [companyId, fromIso, toIso]
    ),
    campaignsActive: count(
      "SELECT COUNT(*) AS n FROM campaigns WHERE company_id = ? AND status = 'active'",
      [companyId]
    ),
    tasksCompleted: count(
      "SELECT COUNT(*) AS n FROM tasks WHERE company_id = ? AND status = 'done' AND updated_at BETWEEN ? AND ?",
      [companyId, fromIso, toIso]
    ),
    publications: count(
      "SELECT COUNT(*) AS n FROM publications WHERE company_id = ? AND status = 'published' AND published_at BETWEEN ? AND ?",
      [companyId, fromIso, toIso]
    ),
    reach: Number(
      all<{ total: number }>(
        "SELECT COALESCE(SUM(reach),0) AS total FROM publication_metrics WHERE company_id = ? AND captured_at BETWEEN ? AND ?",
        [companyId, fromIso, toIso]
      )[0]?.total ?? 0
    ),
    impressions: Number(
      all<{ total: number }>(
        "SELECT COALESCE(SUM(impressions),0) AS total FROM publication_metrics WHERE company_id = ? AND captured_at BETWEEN ? AND ?",
        [companyId, fromIso, toIso]
      )[0]?.total ?? 0
    ),
    engagement: Number(
      all<{ total: number }>(
        "SELECT COALESCE(SUM(engagement),0) AS total FROM publication_metrics WHERE company_id = ? AND captured_at BETWEEN ? AND ?",
        [companyId, fromIso, toIso]
      )[0]?.total ?? 0
    ),
  };
}

export type AnalyticsSummary = {
  period: Period;
  current: Totals;
  previous: Totals;
  contentsByStatus: { status: string; total: number }[];
  contentsByType: { type: string; total: number }[];
  campaignSummary: { total: number; active: number; budgetCents: number; byStatus: { status: string; total: number }[] };
  audienceByPlatform: { platform: string; followers: number; capturedOn: string; source: string }[];
  platformActivity: { platform: string; total: number }[];
  accountsConnected: number;
  accountsTotal: number;
  snapshotCount: number;
  series: { date: string; created: number; published: number }[];
  topContents: { id: string; title: string; platform: string; engagement: number; reach: number; publishedAt: string | null }[];
  dataNotes: string[];
};

export function analyticsSummary(companyId: string, period: Period): AnalyticsSummary {
  const current = totalsFor(companyId, period.fromIso, period.toIso);
  const previous = totalsFor(companyId, period.prevFromIso, period.prevToIso);

  const contentsByStatus = all<{ status: string; total: number }>(
    "SELECT status, COUNT(*) AS total FROM contents WHERE company_id = ? AND archived_at IS NULL GROUP BY status ORDER BY total DESC",
    [companyId]
  );
  const contentsByType = all<{ type: string; total: number }>(
    "SELECT type, COUNT(*) AS total FROM contents WHERE company_id = ? AND archived_at IS NULL GROUP BY type ORDER BY total DESC",
    [companyId]
  );
  const campaignByStatus = all<{ status: string; total: number }>(
    "SELECT status, COUNT(*) AS total FROM campaigns WHERE company_id = ? GROUP BY status",
    [companyId]
  );
  const campaignTotals = all<{ total: number; active: number; budget: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
            COALESCE(SUM(budget_cents),0) AS budget
     FROM campaigns WHERE company_id = ?`,
    [companyId]
  )[0] ?? { total: 0, active: 0, budget: 0 };

  const audienceByPlatform = all<{ platform: string; followers: number; captured_on: string; source: string }>(
    `SELECT s.platform, s.followers, s.captured_on, s.source
     FROM analytics_snapshots s
     JOIN (SELECT platform, MAX(captured_on) AS last_date FROM analytics_snapshots WHERE company_id = ? GROUP BY platform) latest
       ON latest.platform = s.platform AND latest.last_date = s.captured_on
     WHERE s.company_id = ?
     ORDER BY s.platform`,
    [companyId, companyId]
  ).map((row) => ({
    platform: row.platform,
    followers: Number(row.followers ?? 0),
    capturedOn: row.captured_on,
    source: row.source,
  }));

  const platformActivity = all<{ platform: string; total: number }>(
    `SELECT platform, COUNT(*) AS total FROM publications
     WHERE company_id = ? AND status = 'published' AND published_at BETWEEN ? AND ?
     GROUP BY platform ORDER BY total DESC`,
    [companyId, period.fromIso, period.toIso]
  );

  const accountsTotal = count("SELECT COUNT(*) AS n FROM social_accounts WHERE company_id = ?", [companyId]);
  const accountsConnected = count(
    "SELECT COUNT(*) AS n FROM social_accounts WHERE company_id = ? AND status = 'connected'",
    [companyId]
  );
  const snapshotCount = count(
    "SELECT COUNT(*) AS n FROM analytics_snapshots WHERE company_id = ? AND captured_on BETWEEN ? AND ?",
    [companyId, period.from, period.to]
  );

  const seriesRows = all<{ day: string; created: number; published: number }>(
    `SELECT day,
            SUM(CASE WHEN kind = 'created' THEN 1 ELSE 0 END) AS created,
            SUM(CASE WHEN kind = 'published' THEN 1 ELSE 0 END) AS published
     FROM (
       SELECT substr(created_at,1,10) AS day, 'created' AS kind FROM contents
       WHERE company_id = ? AND created_at BETWEEN ? AND ?
       UNION ALL
       SELECT substr(published_at,1,10) AS day, 'published' AS kind FROM contents
       WHERE company_id = ? AND published_at BETWEEN ? AND ?
     )
     GROUP BY day ORDER BY day`,
    [companyId, period.fromIso, period.toIso, companyId, period.fromIso, period.toIso]
  );

  const series = seriesRows.map((row) => ({
    date: row.day,
    created: Number(row.created ?? 0),
    published: Number(row.published ?? 0),
  }));

  const topContents = all<{
    id: string;
    title: string;
    platform: string;
    engagement: number;
    reach: number;
    published_at: string | null;
  }>(
    `SELECT c.id, c.title, p.platform,
            COALESCE(SUM(m.engagement),0) AS engagement,
            COALESCE(SUM(m.reach),0) AS reach,
            p.published_at
     FROM publication_metrics m
     JOIN publications p ON p.id = m.publication_id
     JOIN contents c ON c.id = p.content_id
     WHERE m.company_id = ? AND m.captured_at BETWEEN ? AND ?
     GROUP BY c.id, p.platform
     ORDER BY engagement DESC
     LIMIT 8`,
    [companyId, period.fromIso, period.toIso]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    platform: row.platform,
    engagement: Number(row.engagement),
    reach: Number(row.reach),
    publishedAt: row.published_at,
  }));

  const dataNotes = [
    "Portee, impressions et engagement proviennent uniquement des releves enregistres dans la plateforme (saisie manuelle ou API connectee).",
    accountsConnected === 0
      ? "Aucun compte social n'est connecte : les statistiques de reseaux sociaux resteront vides tant qu'une connexion officielle n'est pas etablie."
      : "Les comptes connectes alimenteront les statistiques des lors que la synchronisation d'API sera activee.",
  ];

  return {
    period,
    current,
    previous,
    contentsByStatus,
    contentsByType,
    campaignSummary: {
      total: Number(campaignTotals.total ?? 0),
      active: Number(campaignTotals.active ?? 0),
      budgetCents: Number(campaignTotals.budget ?? 0),
      byStatus: campaignByStatus,
    },
    audienceByPlatform,
    platformActivity,
    accountsConnected,
    accountsTotal,
    snapshotCount,
    series,
    topContents,
    dataNotes,
  };
}
