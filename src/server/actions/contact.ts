"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nowIso, run } from "@/lib/db";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { findDuplicate } from "@/lib/contacts";
import { clientContactSchema, employeeContactSchema, zodMessage } from "@/lib/validation";

function enc(value: string) {
  return encodeURIComponent(value);
}

export async function createClientContactAction(formData: FormData) {
  const user = await requireUser("contacts.clients.manage");
  const companyId = user.companyId!;
  const parsed = clientContactSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    email: formData.get("email") ?? "",
    companyName: formData.get("companyName") ?? "",
    category: formData.get("category") ?? "",
    notes: formData.get("notes") ?? "",
    tags: formData.get("tags") ?? "",
    consentEmail: formData.get("consentEmail") === "on",
    consentWhatsapp: formData.get("consentWhatsapp") === "on",
    consentSource: formData.get("consentSource") ?? "",
  });
  if (!parsed.success) redirect(`/app/contacts?error=${enc(zodMessage(parsed.error))}`);
  const data = parsed.data;
  const duplicate = findDuplicate(companyId, "client", data);
  if (duplicate) {
    redirect(`/app/contacts?error=${enc(`Doublon détecté : un contact existe déjà avec ce téléphone ou cet email (${duplicate.name}).`)}`);
  }
  const id = newId();
  run(
    `INSERT INTO contacts (id, company_id, kind, name, phone, whatsapp, email, company_name, category, notes, tags,
       consent_email, consent_whatsapp, consent_source, consent_at, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      companyId,
      "client",
      data.name,
      data.phone || null,
      data.whatsapp || null,
      data.email || null,
      data.companyName || null,
      data.category || null,
      data.notes || null,
      data.tags || null,
      data.consentEmail ? 1 : 0,
      data.consentWhatsapp ? 1 : 0,
      data.consentSource || null,
      data.consentEmail || data.consentWhatsapp ? nowIso() : null,
      user.id,
      nowIso(),
      nowIso(),
    ]
  );
  logAudit({ companyId, actor: user, action: "contact.created", entity: "contact", entityId: id, details: data.name, ip: await clientIp() });
  revalidatePath("/app/contacts");
  redirect(`/app/contacts?saved=${enc("Contact créé")}`);
}

export async function updateClientContactAction(formData: FormData) {
  const user = await requireUser("contacts.clients.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const existing = get<{ id: string }>("SELECT id FROM contacts WHERE id = ? AND company_id = ? AND kind = 'client'", [id, companyId]);
  if (!existing) redirect(`/app/contacts?error=${enc("Contact introuvable.")}`);
  const parsed = clientContactSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    email: formData.get("email") ?? "",
    companyName: formData.get("companyName") ?? "",
    category: formData.get("category") ?? "",
    notes: formData.get("notes") ?? "",
    tags: formData.get("tags") ?? "",
    consentEmail: formData.get("consentEmail") === "on",
    consentWhatsapp: formData.get("consentWhatsapp") === "on",
    consentSource: formData.get("consentSource") ?? "",
  });
  if (!parsed.success) redirect(`/app/contacts?error=${enc(zodMessage(parsed.error))}`);
  const data = parsed.data;
  const duplicate = findDuplicate(companyId, "client", data, id);
  if (duplicate) {
    redirect(`/app/contacts?error=${enc(`Doublon détecté : ${duplicate.name} utilise déjà ces coordonnées.`)}`);
  }
  run(
    `UPDATE contacts SET name = ?, phone = ?, whatsapp = ?, email = ?, company_name = ?, category = ?, notes = ?, tags = ?,
       consent_email = ?, consent_whatsapp = ?, consent_source = ?, consent_at = ?, updated_at = ?
     WHERE id = ? AND company_id = ?`,
    [
      data.name,
      data.phone || null,
      data.whatsapp || null,
      data.email || null,
      data.companyName || null,
      data.category || null,
      data.notes || null,
      data.tags || null,
      data.consentEmail ? 1 : 0,
      data.consentWhatsapp ? 1 : 0,
      data.consentSource || null,
      data.consentEmail || data.consentWhatsapp ? nowIso() : null,
      nowIso(),
      id,
      companyId,
    ]
  );
  logAudit({ companyId, actor: user, action: "contact.updated", entity: "contact", entityId: id, details: data.name, ip: await clientIp() });
  revalidatePath("/app/contacts");
  redirect(`/app/contacts?saved=${enc("Contact enregistré")}`);
}

export async function createEmployeeContactAction(formData: FormData) {
  const user = await requireUser("contacts.employees.manage");
  const companyId = user.companyId!;
  const parsed = employeeContactSchema.safeParse({
    name: formData.get("name"),
    jobTitle: formData.get("jobTitle") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    department: formData.get("department") ?? "",
    managerName: formData.get("managerName") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) redirect(`/app/team-contacts?error=${enc(zodMessage(parsed.error))}`);
  const data = parsed.data;
  const duplicate = findDuplicate(companyId, "employee", data);
  if (duplicate) {
    redirect(`/app/team-contacts?error=${enc(`Doublon détecté : ${duplicate.name} existe déjà dans le répertoire collaborateurs.`)}`);
  }
  const id = newId();
  run(
    `INSERT INTO contacts (id, company_id, kind, name, phone, email, job_title, department, manager_name, notes, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      companyId,
      "employee",
      data.name,
      data.phone || null,
      data.email || null,
      data.jobTitle || null,
      data.department || null,
      data.managerName || null,
      data.notes || null,
      user.id,
      nowIso(),
      nowIso(),
    ]
  );
  logAudit({ companyId, actor: user, action: "employee_contact.created", entity: "contact", entityId: id, details: data.name, ip: await clientIp() });
  revalidatePath("/app/team-contacts");
  redirect(`/app/team-contacts?saved=${enc("Collaborateur ajouté")}`);
}

export async function updateEmployeeContactAction(formData: FormData) {
  const user = await requireUser("contacts.employees.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const existing = get<{ id: string }>("SELECT id FROM contacts WHERE id = ? AND company_id = ? AND kind = 'employee'", [id, companyId]);
  if (!existing) redirect(`/app/team-contacts?error=${enc("Collaborateur introuvable.")}`);
  const parsed = employeeContactSchema.safeParse({
    name: formData.get("name"),
    jobTitle: formData.get("jobTitle") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    department: formData.get("department") ?? "",
    managerName: formData.get("managerName") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) redirect(`/app/team-contacts?error=${enc(zodMessage(parsed.error))}`);
  const data = parsed.data;
  const duplicate = findDuplicate(companyId, "employee", data, id);
  if (duplicate) redirect(`/app/team-contacts?error=${enc(`Doublon détecté : ${duplicate.name}.`)}`);
  run(
    `UPDATE contacts SET name = ?, phone = ?, email = ?, job_title = ?, department = ?, manager_name = ?, notes = ?, updated_at = ?
     WHERE id = ? AND company_id = ?`,
    [
      data.name,
      data.phone || null,
      data.email || null,
      data.jobTitle || null,
      data.department || null,
      data.managerName || null,
      data.notes || null,
      nowIso(),
      id,
      companyId,
    ]
  );
  logAudit({ companyId, actor: user, action: "employee_contact.updated", entity: "contact", entityId: id, details: data.name, ip: await clientIp() });
  revalidatePath("/app/team-contacts");
  redirect(`/app/team-contacts?saved=${enc("Collaborateur enregistré")}`);
}

export async function deleteContactAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "client");
  const permission = kind === "employee" ? "contacts.employees.manage" : "contacts.clients.manage";
  const user = await requireUser(permission);
  const companyId = user.companyId!;
  const contact = get<{ name: string }>("SELECT name FROM contacts WHERE id = ? AND company_id = ? AND kind = ?", [id, companyId, kind]);
  if (!contact) redirect(kind === "employee" ? "/app/team-contacts" : "/app/contacts");
  run("DELETE FROM contacts WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({ companyId, actor: user, action: "contact.deleted", entity: "contact", entityId: id, details: contact.name, ip: await clientIp() });
  revalidatePath(kind === "employee" ? "/app/team-contacts" : "/app/contacts");
  redirect(`${kind === "employee" ? "/app/team-contacts" : "/app/contacts"}?saved=${enc("Contact supprimé")}`);
}

export async function addInteractionAction(formData: FormData) {
  const id = String(formData.get("contactId") ?? "");
  const user = await requireUser("contacts.clients.view");
  const companyId = user.companyId!;
  const contact = get<{ id: string }>("SELECT id FROM contacts WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!contact) redirect(`/app/contacts?error=${enc("Contact introuvable.")}`);
  const channel = String(formData.get("channel") ?? "note");
  const subject = String(formData.get("subject") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!subject && !notes) redirect(`/app/contacts?error=${enc("Renseignez un objet ou une note.")}`);
  run(
    `INSERT INTO contact_interactions (id, company_id, contact_id, channel, direction, subject, notes, occurred_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      companyId,
      id,
      channel,
      String(formData.get("direction") ?? "out"),
      subject || null,
      notes || null,
      formData.get("occurredAt") ? new Date(String(formData.get("occurredAt"))).toISOString() : nowIso(),
      user.id,
    ]
  );
  logAudit({ companyId, actor: user, action: "contact.interaction", entity: "contact", entityId: id, details: channel, ip: await clientIp() });
  revalidatePath("/app/contacts");
  redirect(`/app/contacts?edit=${id}&saved=${enc("Interaction enregistrée")}`);
}

/** Import CSV : colonnes name;phone;whatsapp;email;company;category;notes;tags */
export async function importContactsAction(formData: FormData) {
  const kind = String(formData.get("kind") ?? "client");
  const permission = kind === "employee" ? "contacts.employees.manage" : "contacts.clients.manage";
  const user = await requireUser(permission);
  const companyId = user.companyId!;
  const file = formData.get("file");
  const target = kind === "employee" ? "/app/team-contacts" : "/app/contacts";

  if (!(file instanceof File) || file.size === 0) {
    redirect(`${target}?error=${enc("Sélectionnez un fichier CSV.")}`);
  }
  if (file.size > 5 * 1024 * 1024) {
    redirect(`${target}?error=${enc("Fichier trop volumineux (5 Mo maximum).")}`);
  }
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) redirect(`${target}?error=${enc("Fichier CSV vide.")}`);

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = header.some((cell) => ["nom", "name", "téléphone", "telephone", "phone"].includes(cell));
  const indexOf = (names: string[]) => header.findIndex((cell) => names.includes(cell));
  const columns = hasHeader
    ? {
        name: indexOf(["nom", "name"]),
        phone: indexOf(["téléphone", "telephone", "phone", "tel"]),
        whatsapp: indexOf(["whatsapp"]),
        email: indexOf(["email", "e-mail", "mail"]),
        company: indexOf(["entreprise", "company", "societe", "société"]),
        category: indexOf(["categorie", "catégorie", "category"]),
        jobTitle: indexOf(["fonction", "poste", "job", "jobtitle"]),
        department: indexOf(["service", "departement", "département", "department"]),
        notes: indexOf(["notes", "observations", "note"]),
        tags: indexOf(["tags", "etiquettes", "étiquettes"]),
      }
    : { name: 0, phone: 1, whatsapp: 2, email: 3, company: 4, category: 5, jobTitle: 5, department: 6, notes: 6, tags: 7 };

  let imported = 0;
  let duplicates = 0;
  let rejected = 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const pick = (index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");
    const name = pick(columns.name);
    if (name.length < 2) {
      rejected += 1;
      continue;
    }
    const phone = pick(columns.phone);
    const whatsapp = pick(columns.whatsapp);
    const email = pick(columns.email);
    const duplicate = findDuplicate(companyId, kind, { phone, whatsapp, email });
    if (duplicate) {
      duplicates += 1;
      continue;
    }
    run(
      `INSERT INTO contacts (id, company_id, kind, name, phone, whatsapp, email, company_name, category, job_title, department,
         notes, tags, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        newId(),
        companyId,
        kind,
        name,
        phone || null,
        kind === "client" ? whatsapp || null : null,
        email || null,
        kind === "client" ? pick(columns.company) || null : null,
        kind === "client" ? pick(columns.category) || null : null,
        kind === "employee" ? pick(columns.jobTitle) || null : null,
        kind === "employee" ? pick(columns.department) || null : null,
        pick(columns.notes) || null,
        kind === "client" ? pick(columns.tags) || null : null,
        user.id,
        nowIso(),
        nowIso(),
      ]
    );
    imported += 1;
  }

  logAudit({
    companyId,
    actor: user,
    action: "contacts.imported",
    entity: "contact",
    details: `kind=${kind}; importés=${imported}; doublons=${duplicates}; rejetés=${rejected}`,
    ip: await clientIp(),
  });
  revalidatePath(target);
  redirect(
    `${target}?saved=${enc(`Import terminé : ${imported} ajouté(s), ${duplicates} doublon(s) ignoré(s), ${rejected} ligne(s) rejetée(s).`)}`
  );
}
