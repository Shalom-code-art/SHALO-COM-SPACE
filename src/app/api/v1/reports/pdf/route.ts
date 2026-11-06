import type { NextRequest } from "next/server";
import { clientIp, requireApiUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formatNumber } from "@/lib/format";
import { buildReportPdf } from "@/lib/pdf";
import { analyticsSummary, resolvePeriod } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireApiUser("analytics.export");
  if (!user || !user.companyId || !user.company) {
    return new Response("Accès refusé : authentification requise.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const period = resolvePeriod(from, to);
  const summary = analyticsSummary(user.companyId, period);

  const pdf = await buildReportPdf({
    title: "Rapport de communication et marketing",
    companyName: user.company.name,
    period: `${period.from} au ${period.to}`,
    generatedAt: new Date().toLocaleString("fr-FR"),
    kpis: [
      { label: "Contenus créés", value: formatNumber(summary.current.contentsCreated) },
      { label: "Contenus publiés", value: formatNumber(summary.current.contentsPublished) },
      { label: "Contenus programmés", value: formatNumber(summary.current.contentsScheduled) },
      { label: "Contacts ajoutés", value: formatNumber(summary.current.contactsAdded) },
      { label: "Interactions clients", value: formatNumber(summary.current.interactions) },
      { label: "Publications déclarées", value: formatNumber(summary.current.publications) },
      { label: "Portée cumulée", value: formatNumber(summary.current.reach) },
      { label: "Engagement cumulé", value: formatNumber(summary.current.engagement) },
    ],
    table: {
      headers: ["Indicateur", "Période", "Période précédente"],
      rows: [
        ["Contenus créés", String(summary.current.contentsCreated), String(summary.previous.contentsCreated)],
        ["Contenus publiés", String(summary.current.contentsPublished), String(summary.previous.contentsPublished)],
        ["Contacts ajoutés", String(summary.current.contactsAdded), String(summary.previous.contactsAdded)],
        ["Interactions clients", String(summary.current.interactions), String(summary.previous.interactions)],
        ["Tâches terminées", String(summary.current.tasksCompleted), String(summary.previous.tasksCompleted)],
        ["Campagnes actives", String(summary.current.campaignsActive), String(summary.previous.campaignsActive)],
        ["Portée", String(summary.current.reach), String(summary.previous.reach)],
        ["Impressions", String(summary.current.impressions), String(summary.previous.impressions)],
        ["Engagement", String(summary.current.engagement), String(summary.previous.engagement)],
        [
          "Comptes sociaux connectés",
          `${summary.accountsConnected}/${summary.accountsTotal}`,
          "non applicable",
        ],
      ],
    },
    notes: [
      ...summary.dataNotes,
      "Rapport généré à partir des données enregistrées dans SHALO COM SPACE au moment de l'export.",
      "Aucune valeur n'est extrapolée : les indicateurs absents restent à zéro.",
    ],
  });

  logAudit({
    companyId: user.companyId,
    actor: user,
    action: "report.exported",
    entity: "report",
    details: `pdf · ${period.from} → ${period.to}`,
    ip: await clientIp(),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="rapport-${period.from}-${period.to}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
