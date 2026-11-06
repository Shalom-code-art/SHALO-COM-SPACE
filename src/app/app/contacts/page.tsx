import Link from "next/link";
import { ConfirmSubmit, Disclosure, SearchForm } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Avatar, Badge, Card, CardHeader, EmptyState, Flash, InfoRow, PageHeader, StatCard, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count, get } from "@/lib/db";
import { formatDateTime, labelOf } from "@/lib/format";
import {
  addInteractionAction,
  createClientContactAction,
  deleteContactAction,
  importContactsAction,
  updateClientContactAction,
} from "@/server/actions/contact";

export const metadata = { title: "Contacts clients" };

const INTERACTION_CHANNELS = {
  call: "Appel",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Rendez-vous",
  note: "Note",
  other: "Autre",
} as const;

function ContactFields({ contact }: { contact?: Record<string, unknown> }) {
  const value = (key: string) => String(contact?.[key] ?? "");
  return (
    <>
      <div className="md:col-span-2">
        <label className="label" htmlFor="name">Nom du contact *</label>
        <input id="name" name="name" required defaultValue={value("name")} className="input" placeholder="Ex. Marie Nzamba" />
      </div>
      <div>
        <label className="label" htmlFor="companyName">Entreprise</label>
        <input id="companyName" name="companyName" defaultValue={value("company_name")} className="input" placeholder="Ex. Cabinet Ozangué" />
      </div>
      <div>
        <label className="label" htmlFor="category">Catégorie</label>
        <input id="category" name="category" list="contact-categories" defaultValue={value("category")} className="input" placeholder="Client, Prospect, Partenaire…" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Téléphone</label>
        <input id="phone" name="phone" defaultValue={value("phone")} className="input" placeholder="+241 06 00 00 00" />
      </div>
      <div>
        <label className="label" htmlFor="whatsapp">WhatsApp</label>
        <input id="whatsapp" name="whatsapp" defaultValue={value("whatsapp")} className="input" placeholder="+241 06 00 00 00" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={value("email")} className="input" placeholder="contact@entreprise.com" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="tags">Étiquettes</label>
        <input id="tags" name="tags" defaultValue={value("tags")} className="input" placeholder="devis, libreville, vip" />
        <p className="hint">Séparez les étiquettes par des virgules.</p>
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="notes">Notes internes</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={value("notes")} className="input" />
      </div>
      <div className="md:col-span-2 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
        <p className="mb-2 text-[12px] font-semibold text-ink-800">Consentement et conformité</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
          <label className="flex items-center gap-2 text-[12px] text-ink-700">
            <input type="checkbox" name="consentEmail" defaultChecked={Boolean(Number(contact?.consent_email ?? 0))} className="h-3.5 w-3.5" />
            Consentement email
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ink-700">
            <input type="checkbox" name="consentWhatsapp" defaultChecked={Boolean(Number(contact?.consent_whatsapp ?? 0))} className="h-3.5 w-3.5" />
            Consentement WhatsApp
          </label>
        </div>
        <div className="mt-2">
          <label className="label" htmlFor="consentSource">Origine du consentement</label>
          <input id="consentSource" name="consentSource" defaultValue={value("consent_source")} className="input" placeholder="Formulaire site web, fiche papier signée, message WhatsApp…" />
        </div>
        <p className="hint">Le consentement doit être recueilli avant toute campagne email ou WhatsApp. Ces informations sont conservées pour la traçabilité.</p>
      </div>
    </>
  );
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; consent?: string; edit?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("contacts.clients.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const canManage = user.permissions.includes("contacts.clients.manage");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const totals = get<{ total: number; with_consent: number; this_month: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN consent_email = 1 OR consent_whatsapp = 1 THEN 1 ELSE 0 END), 0) AS with_consent,
            COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS this_month
     FROM contacts WHERE company_id = ? AND kind = 'client'`,
    [monthStart.toISOString(), companyId]
  ) ?? { total: 0, with_consent: 0, this_month: 0 };

  const interactionsThisMonth = count(
    `SELECT COUNT(*) AS n FROM contact_interactions ci
     JOIN contacts c ON c.id = ci.contact_id
     WHERE ci.company_id = ? AND c.kind = 'client' AND ci.occurred_at >= ?`,
    [companyId, monthStart.toISOString()]
  );

  const categories = all<{ category: string }>(
    `SELECT DISTINCT category FROM contacts
     WHERE company_id = ? AND kind = 'client' AND category IS NOT NULL AND TRIM(category) <> ''
     ORDER BY category`,
    [companyId]
  );

  const where = ["c.company_id = ?", "c.kind = 'client'"];
  const args: unknown[] = [companyId];
  if (query.q) {
    where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ? OR c.email LIKE ? OR c.company_name LIKE ? OR c.tags LIKE ?)");
    const like = `%${query.q.trim()}%`;
    args.push(like, like, like, like, like, like);
  }
  if (query.category) {
    where.push("c.category = ?");
    args.push(query.category);
  }
  if (query.consent === "email") where.push("c.consent_email = 1");
  if (query.consent === "whatsapp") where.push("c.consent_whatsapp = 1");
  if (query.consent === "none") where.push("c.consent_email = 0 AND c.consent_whatsapp = 0");

  const contacts = all<{
    id: string;
    name: string;
    company_name: string | null;
    category: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    tags: string | null;
    consent_email: number;
    consent_whatsapp: number;
    updated_at: string;
    interactions: number;
    last_interaction: string | null;
  }>(
    `SELECT c.id, c.name, c.company_name, c.category, c.phone, c.whatsapp, c.email, c.tags,
            c.consent_email, c.consent_whatsapp, c.updated_at,
            (SELECT COUNT(*) FROM contact_interactions ci WHERE ci.contact_id = c.id) AS interactions,
            (SELECT MAX(ci.occurred_at) FROM contact_interactions ci WHERE ci.contact_id = c.id) AS last_interaction
     FROM contacts c
     WHERE ${where.join(" AND ")}
     ORDER BY c.updated_at DESC
     LIMIT 200`,
    args
  );

  const editing = query.edit
    ? get<Record<string, unknown>>(
        "SELECT * FROM contacts WHERE id = ? AND company_id = ? AND kind = 'client'",
        [query.edit, companyId]
      )
    : null;

  const interactions = editing
    ? all<{
        id: string;
        channel: string;
        direction: string;
        subject: string | null;
        notes: string | null;
        occurred_at: string;
        author: string | null;
      }>(
        `SELECT ci.id, ci.channel, ci.direction, ci.subject, ci.notes, ci.occurred_at, u.name AS author
         FROM contact_interactions ci LEFT JOIN users u ON u.id = ci.created_by
         WHERE ci.company_id = ? AND ci.contact_id = ?
         ORDER BY ci.occurred_at DESC LIMIT 40`,
        [companyId, editing.id]
      )
    : [];

  const tabHref = (consent?: string) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.category) params.set("category", query.category);
    if (consent) params.set("consent", consent);
    const search = params.toString();
    return `/app/contacts${search ? `?${search}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Contacts clients & prospects"
        subtitle="Répertoire commercial séparé du personnel : coordonnées, étiquettes, historique des échanges et consentement."
        icon="users"
        actions={
          <>
            <Link href="/api/v1/contacts/export?kind=client" className="btn" prefetch={false}>
              <Icon name="download" className="h-4 w-4" /> Export CSV
            </Link>
            <Link href="/app/team-contacts" className="btn">
              <Icon name="briefcase" className="h-4 w-4" /> Répertoire collaborateurs
            </Link>
          </>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contacts clients" value={totals.total} icon="users" tone="brand" />
        <StatCard label="Avec consentement" value={totals.with_consent} icon="shield" tone="emerald" hint="Email ou WhatsApp" />
        <StatCard label="Ajoutés ce mois" value={totals.this_month} icon="plus" tone="sky" />
        <StatCard label="Interactions ce mois" value={interactionsThisMonth} icon="message" tone="violet" />
      </div>

      <datalist id="contact-categories">
        {categories.map((row) => (
          <option key={row.category} value={row.category} />
        ))}
      </datalist>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SearchForm action="/app/contacts" placeholder="Nom, téléphone, email, étiquette…" defaultValue={query.q ?? ""} hidden={query.category ? { category: query.category } : {}} />
        {query.category ? (
          <Link href="/app/contacts" className="badge border-brand-200 bg-brand-50 text-brand-700">
            Catégorie : {query.category} <Icon name="close" className="h-3 w-3" />
          </Link>
        ) : null}
      </div>

      <div className="mt-3">
        <Tabs
          items={[
            { label: "Tous", href: tabHref(), active: !query.consent, count: totals.total },
            { label: "Consentement email", href: tabHref("email"), active: query.consent === "email" },
            { label: "Consentement WhatsApp", href: tabHref("whatsapp"), active: query.consent === "whatsapp" },
            { label: "Sans consentement", href: tabHref("none"), active: query.consent === "none" },
          ]}
        />
      </div>

      {canManage ? (
        <div className="mb-4 flex flex-wrap items-start gap-2">
          <Disclosure title="Nouveau contact">
            <form action={createClientContactAction} className="card card-pad grid gap-3 md:grid-cols-2">
              <ContactFields />
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer le contact
                </button>
              </div>
            </form>
          </Disclosure>
          <Disclosure title="Importer un CSV" variant="ghost">
            <form action={importContactsAction} className="card card-pad space-y-3">
              <input type="hidden" name="kind" value="client" />
              <p className="text-[12px] text-ink-600">
                Colonnes reconnues : <code className="rounded bg-ink-100 px-1">nom;telephone;whatsapp;email;entreprise;categorie;notes;tags</code>.
                Les doublons (téléphone ou email identiques) sont ignorés automatiquement.
              </p>
              <input type="file" name="file" accept=".csv,text/csv" required className="input" />
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="upload" className="h-4 w-4" /> Lancer l'import
                </button>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}

      {editing ? (
        <div className="mb-4 grid gap-3 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader
              title={`Fiche : ${String(editing.name)}`}
              subtitle="Modifier le contact et son consentement"
              icon="user"
              action={
                <Link href="/app/contacts" className="btn btn-sm">
                  <Icon name="close" className="h-3.5 w-3.5" /> Fermer
                </Link>
              }
            />
            <form action={updateClientContactAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="id" value={String(editing.id)} />
              <ContactFields contact={editing} />
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-ink-400">Mis à jour le {formatDateTime(String(editing.updated_at))}</p>
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer
                </button>
              </div>
            </form>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader title="Historique des interactions" subtitle="Appels, messages, rendez-vous et notes" icon="message" />
              {canManage ? (
                <form action={addInteractionAction} className="mb-4 grid gap-2 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
                  <input type="hidden" name="contactId" value={String(editing.id)} />
                  <div className="grid grid-cols-2 gap-2">
                    <select name="channel" className="input" defaultValue="whatsapp" aria-label="Canal">
                      {Object.entries(INTERACTION_CHANNELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <select name="direction" className="input" defaultValue="out" aria-label="Sens">
                      <option value="out">Sortant</option>
                      <option value="in">Entrant</option>
                    </select>
                  </div>
                  <input name="subject" className="input" placeholder="Objet (ex. relance devis)" />
                  <textarea name="notes" rows={2} className="input" placeholder="Détails de l'échange" />
                  <input type="datetime-local" name="occurredAt" className="input" aria-label="Date de l'échange" />
                  <button type="submit" className="btn btn-primary btn-sm justify-self-end">
                    <Icon name="plus" className="h-3.5 w-3.5" /> Ajouter l'interaction
                  </button>
                </form>
              ) : null}
              {interactions.length === 0 ? (
                <p className="text-[12px] text-ink-500">Aucune interaction enregistrée pour ce contact.</p>
              ) : (
                <ol className="space-y-2">
                  {interactions.map((interaction) => (
                    <li key={interaction.id} className="rounded-xl border border-ink-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-ink-800">
                          {labelOf(INTERACTION_CHANNELS, interaction.channel)}
                          <span className="ml-1.5 font-normal text-ink-400">
                            {interaction.direction === "in" ? "reçu" : "envoyé"}
                          </span>
                        </p>
                        <p className="text-[10.5px] text-ink-400">{formatDateTime(interaction.occurred_at)}</p>
                      </div>
                      {interaction.subject ? <p className="mt-0.5 text-[12px] text-ink-700">{interaction.subject}</p> : null}
                      {interaction.notes ? <p className="mt-0.5 whitespace-pre-line text-[11.5px] leading-relaxed text-ink-500">{interaction.notes}</p> : null}
                      {interaction.author ? <p className="mt-1 text-[10.5px] text-ink-400">par {interaction.author}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <CardHeader title="Consentement" subtitle="Preuve et conditions d'usage" icon="shield" />
              <InfoRow
                label="Email"
                value={Number(editing.consent_email) ? <Badge status="approved">Autorisé</Badge> : <Badge status="cancelled">Non recueilli</Badge>}
              />
              <InfoRow
                label="WhatsApp"
                value={Number(editing.consent_whatsapp) ? <Badge status="approved">Autorisé</Badge> : <Badge status="cancelled">Non recueilli</Badge>}
              />
              <InfoRow label="Origine" value={String(editing.consent_source ?? "—")} />
              <InfoRow label="Date" value={editing.consent_at ? formatDateTime(String(editing.consent_at)) : "—"} />
              {canManage ? (
                <form action={deleteContactAction} className="mt-3 flex justify-end">
                  <input type="hidden" name="id" value={String(editing.id)} />
                  <input type="hidden" name="kind" value="client" />
                  <ConfirmSubmit message="Supprimer ce contact et son historique ?">Supprimer le contact</ConfirmSubmit>
                </form>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Répertoire clients"
          subtitle={`${contacts.length} contact(s) affiché(s)`}
          icon="users"
        />
        {contacts.length === 0 ? (
          <EmptyState
            icon="users"
            title="Aucun contact"
            description="Ajoutez vos clients et prospects pour suivre les échanges, les consentements et alimenter vos campagnes."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Coordonnées</th>
                  <th>Catégorie / étiquettes</th>
                  <th>Consentement</th>
                  <th>Interactions</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const tags = (contact.tags ?? "")
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .slice(0, 3);
                  const phoneDigits = (contact.whatsapp || contact.phone || "").replace(/[^\d]/g, "");
                  return (
                    <tr key={contact.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={contact.name} size="sm" />
                          <div className="min-w-0">
                            <Link href={`/app/contacts?edit=${contact.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                              {contact.name}
                            </Link>
                            <p className="truncate text-[11px] text-ink-400">{contact.company_name ?? "Particulier"}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-0.5 text-[11.5px]">
                          {contact.phone ? <p className="text-ink-600">{contact.phone}</p> : null}
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="block truncate text-brand-700 hover:underline">{contact.email}</a>
                          ) : null}
                          {phoneDigits ? (
                            <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                              <Icon name="whatsapp" className="h-3 w-3" /> WhatsApp
                            </a>
                          ) : null}
                          {!contact.phone && !contact.email && !phoneDigits ? <span className="text-ink-400">—</span> : null}
                        </div>
                      </td>
                      <td>
                        <p className="text-[11.5px] text-ink-600">{contact.category ?? "—"}</p>
                        {tags.length ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span key={tag} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={contact.consent_email ? "text-[11px] text-emerald-700" : "text-[11px] text-ink-300"}>
                            <Icon name={contact.consent_email ? "check" : "close"} className="mr-1 inline h-3 w-3" /> Email
                          </span>
                          <span className={contact.consent_whatsapp ? "text-[11px] text-emerald-700" : "text-[11px] text-ink-300"}>
                            <Icon name={contact.consent_whatsapp ? "check" : "close"} className="mr-1 inline h-3 w-3" /> WhatsApp
                          </span>
                        </div>
                      </td>
                      <td>
                        <p className="text-[12px] font-medium text-ink-800">{contact.interactions}</p>
                        <p className="text-[10.5px] text-ink-400">
                          {contact.last_interaction ? formatDateTime(contact.last_interaction) : "jamais"}
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/app/contacts?edit=${contact.id}`} className="btn btn-sm">
                            <Icon name="edit" className="h-3.5 w-3.5" /> Ouvrir
                          </Link>
                          {canManage ? (
                            <form action={deleteContactAction}>
                              <input type="hidden" name="id" value={contact.id} />
                              <input type="hidden" name="kind" value="client" />
                              <ConfirmSubmit message="Supprimer ?">Supprimer</ConfirmSubmit>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
