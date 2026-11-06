"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nowIso, run, transaction } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { campaignSchema, zodMessage } from "@/lib/validation";

function enc(value: string) {
  return encodeURIComponent(value);
}

function parseForm(formData: FormData) {
  return campaignSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "promotion",
    objective: formData.get("objective") ?? "",
    description: formData.get("description") ?? "",
    audience: formData.get("audience") ?? "",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    budget: formData.get("budget") ?? 0,
    currency: formData.get("currency") || "XAF",
    channels: formData.getAll("channels").map(String).filter(Boolean),
    status: formData.get("status") || "planned",
    ownerId: formData.get("ownerId") || null,
    kpiTarget: formData.get("kpiTarget") ?? 0,
    resultsNotes: formData.get("resultsNotes") ?? "",
  });
}

function normalizeDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser("campaign.manage");
  const companyId = user.companyId!;
  const parsed = parseForm(formData);
  if (!parsed.success) redirect(`/app/campaigns?error=${enc(zodMessage(parsed.error))}`);
  const data = parsed.data;

  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    redirect(`/app/campaigns?error=${enc("La date de fin doit être postérieure à la date de début.")}`);
  }
  if (data.ownerId && !get("SELECT id FROM users WHERE id = ? AND company_id = ?", [data.ownerId, companyId])) {
    redirect(`/app/campaigns?error=${enc("Responsable invalide.")}`);
  }

  const id = newId();
  run(
    `INSERT INTO campaigns (id, company_id, name, type, objective, description, audience, start_date, end_date,
       budget_cents, currency, channels, status, owner_id, kpi_target, results_notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      companyId,
      data.name,
      data.type,
      data.objective || null,
      data.description || null,
      data.audience || null,
      normalizeDate(data.startDate || ""),
      normalizeDate(data.endDate || ""),
      Math.round(data.budget * 100),
      data.currency,
      JSON.stringify(data.channels),
      data.status,
      data.ownerId || null,
      Math.round(data.kpiTarget),
      data.resultsNotes || null,
      nowIso(),
      nowIso(),
    ]
  );
  logAudit({ companyId, actor: user, action: "campaign.created", entity: "campaign", entityId: id, details: data.name, ip: await clientIp() });
  notify({ companyId, type: "campaign", title: "Nouvelle campagne", body: data.name, link: `/app/campaigns/${id}` });
  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns/${id}?saved=${enc("Campagne créée")}`);
}

export async function updateCampaignAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requireUser("campaign.manage");
  const companyId = user.companyId!;
  const existing = get<{ id: string; name: string }>("SELECT id, name FROM campaigns WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!existing) redirect(`/app/campaigns?error=${enc("Campagne introuvable.")}`);

  const parsed = parseForm(formData);
  if (!parsed.success) redirect(`/app/campaigns/${id}?error=${enc(zodMessage(parsed.error))}`);
  const data = parsed.data;
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    redirect(`/app/campaigns/${id}?error=${enc("La date de fin doit être postérieure à la date de début.")}`);
  }

  run(
    `UPDATE campaigns SET name = ?, type = ?, objective = ?, description = ?, audience = ?, start_date = ?, end_date = ?,
       budget_cents = ?, currency = ?, channels = ?, status = ?, owner_id = ?, kpi_target = ?, results_notes = ?, updated_at = ?
     WHERE id = ? AND company_id = ?`,
    [
      data.name,
      data.type,
      data.objective || null,
      data.description || null,
      data.audience || null,
      normalizeDate(data.startDate || ""),
      normalizeDate(data.endDate || ""),
      Math.round(data.budget * 100),
      data.currency,
      JSON.stringify(data.channels),
      data.status,
      data.ownerId || null,
      Math.round(data.kpiTarget),
      data.resultsNotes || null,
      nowIso(),
      id,
      companyId,
    ]
  );
  logAudit({ companyId, actor: user, action: "campaign.updated", entity: "campaign", entityId: id, details: data.name, ip: await clientIp() });
  revalidatePath(`/app/campaigns/${id}`);
  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns/${id}?saved=${enc("Campagne enregistrée")}`);
}

export async function deleteCampaignAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requireUser("campaign.manage");
  const companyId = user.companyId!;
  const campaign = get<{ name: string }>("SELECT name FROM campaigns WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!campaign) redirect(`/app/campaigns?error=${enc("Campagne introuvable.")}`);
  transaction(() => {
    run("UPDATE contents SET campaign_id = NULL WHERE campaign_id = ? AND company_id = ?", [id, companyId]);
    run("UPDATE tasks SET campaign_id = NULL WHERE campaign_id = ? AND company_id = ?", [id, companyId]);
    run("DELETE FROM campaigns WHERE id = ? AND company_id = ?", [id, companyId]);
  });
  logAudit({ companyId, actor: user, action: "campaign.deleted", entity: "campaign", entityId: id, details: campaign.name, ip: await clientIp() });
  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns?saved=${enc("Campagne supprimée")}`);
}

export async function setCampaignStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["planned", "active", "paused", "completed", "cancelled"].includes(status)) {
    redirect(`/app/campaigns?error=${enc("Statut invalide.")}`);
  }
  const user = await requireUser("campaign.manage");
  const companyId = user.companyId!;
  run("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ? AND company_id = ?", [status, nowIso(), id, companyId]);
  logAudit({ companyId, actor: user, action: `campaign.status.${status}`, entity: "campaign", entityId: id, ip: await clientIp() });
  revalidatePath("/app/campaigns");
  revalidatePath(`/app/campaigns/${id}`);
}
