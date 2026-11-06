import type { NextRequest } from "next/server";
import { clientIp, requireApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { CONTENT_STATUSES, CONTENT_TYPES, PLATFORMS, labelOf } from "@/lib/format";
import { analyticsSummary, resolvePeriod } from "@/lib/reports";

export const dynamic = "force-dynamic";

type Row = { section: string; label: string; value: string; previous: string };

export async function GET(request: NextRequest) {
  const user = await requireApiUser("analytics.export");
  if (!user || !user.companyId) {
    return new Response("Accès refusé : authentification requise.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const period = resolvePeriod(from, to);
  const summary = analyticsSummary(user.companyId, period);

  const rows: Row[] = [
    { section: "Indicateurs", label: "Contenus créés", value: String(summary.current.contentsCreated), previous: String(summary.previous.contentsCreated) },
    { section: "Indicateurs", label: "Contenus publiés", value: String(summary.current.contentsPublished), previous: String(summary.previous.contentsPublished) },
    { section: "Indicateurs", label: "Contenus programmés", value: String(summary.current.contentsScheduled), previous: String(summary.previous.contentsScheduled) },
    { section: "Indicateurs", label: "Contacts ajoutés", value: String(summary.current.contactsAdded), previous: String(summary.previous.contactsAdded) },
    { section: "Indicateurs", label: "Interactions clients", value: String(summary.current.interactions), previous: String(summary.previous.interactions) },
    { section: "Indicateurs", label: "Publications déclarées", value: String(summary.current.publications), previous: String(summary.previous.publications) },
    { section: "Indicateurs", label: "Tâches terminées", value: String(summary.current.tasksCompleted), previous: String(summary.previous.tasksCompleted) },
    { section: "Indicateurs", label: "Campagnes actives", value: String(summary.current.campaignsActive), previous: String(summary.previous.campaignsActive) },
    { section: "Mesures", label: "Portée", value: String(summary.current.reach), previous: String(summary.previous.reach) },
    { section: "Mesures", label: "Impressions", value: String(summary.current.impressions), previous: String(summary.previous.impressions) },
    { section: "Mesures", label: "Engagement", value: String(summary.current.engagement), previous: String(summary.previous.engagement) },
    { section: "Contexte", label: "Comptes sociaux connectés", value: `${summary.accountsConnected}/${summary.accountsTotal}`, previous: "" },
    { section: "Contexte", label: "Relevés saisis sur la période", value: String(summary.snapshotCount), previous: "" },
    ...summary.contentsByStatus.map((row) => ({
      section: "Contenus par statut",
      label: labelOf(CONTENT_STATUSES, row.status),
      value: String(row.total),
      previous: "",
    })),
    ...summary.contentsByType.map((row) => ({
      section: "Contenus par type",
      label: labelOf(CONTENT_TYPES, row.type),
      value: String(row.total),
      previous: "",
    })),
    ...summary.platformActivity.map((row) => ({
      section: "Publications par réseau",
      label: labelOf(PLATFORMS, row.platform),
      value: String(row.total),
      previous: "",
    })),
    ...summary.audienceByPlatform.map((row) => ({
      section: "Audience (dernier relevé)",
      label: `${labelOf(PLATFORMS, row.platform)} — ${row.capturedOn}`,
      value: String(row.followers),
      previous: row.source,
    })),
  ];

  const csv = toCsv<Row>(rows, [
    { key: "section", label: "section" },
    { key: "label", label: "indicateur" },
    { key: "value", label: "valeur" },
    { key: "previous", label: "periode_precedente_ou_source" },
  ]);

  logAudit({
    companyId: user.companyId,
    actor: user,
    action: "report.exported",
    entity: "report",
    details: `csv · ${period.from} → ${period.to}`,
    ip: await clientIp(),
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rapport-${period.from}-${period.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
