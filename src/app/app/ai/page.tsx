import Link from "next/link";
import { ConfirmSubmit, CopyButton } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, EmptyState, Flash, InfoRow, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count, get } from "@/lib/db";
import { AI_KINDS, AI_LANGUAGES, EDITORIAL_TONES, PLATFORMS, formatDateTime, labelOf } from "@/lib/format";
import { AI_PROVIDERS } from "@/lib/ai-providers";
import { resolveAiConfig } from "@/lib/settings";
import { convertGenerationAction, deleteGenerationAction, generateAiAction } from "@/server/actions/ai";

export const metadata = { title: "Centre IA" };

type GenerationRow = {
  id: string;
  kind: string;
  platform: string | null;
  tone: string | null;
  language: string | null;
  prompt: string | null;
  output: string | null;
  provider: string | null;
  model: string | null;
  content_id: string | null;
  created_at: string;
  author: string | null;
};

const HISTORY_COLUMNS = `g.id, g.kind, g.platform, g.tone, g.language, g.prompt, g.output, g.provider, g.model,
  g.content_id, g.created_at, u.name AS author`;

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("ai.use");
  const companyId = user.companyId!;
  const query = await searchParams;
  const config = resolveAiConfig(companyId);

  const generation = query.generation
    ? get<GenerationRow>(
        `SELECT ${HISTORY_COLUMNS} FROM ai_generations g LEFT JOIN users u ON u.id = g.user_id
         WHERE g.id = ? AND g.company_id = ?`,
        [query.generation, companyId]
      )
    : null;

  const history = all<GenerationRow>(
    `SELECT ${HISTORY_COLUMNS} FROM ai_generations g LEFT JOIN users u ON u.id = g.user_id
     WHERE g.company_id = ? ORDER BY g.created_at DESC LIMIT 15`,
    [companyId]
  );

  const totalGenerations = count("SELECT COUNT(*) AS n FROM ai_generations WHERE company_id = ?", [companyId]);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const last30 = count("SELECT COUNT(*) AS n FROM ai_generations WHERE company_id = ? AND created_at >= ?", [
    companyId,
    since,
  ]);
  const converted = count("SELECT COUNT(*) AS n FROM ai_generations WHERE company_id = ? AND content_id IS NOT NULL", [
    companyId,
  ]);

  return (
    <>
      <PageHeader
        title="Centre IA"
        subtitle="Générez, corrigez et déclinez vos contenus avec un fournisseur d'intelligence artificielle réellement connecté."
        icon="sparkles"
        actions={
          <Link href="/app/settings?section=ai" className="btn">
            <Icon name="settings" className="h-4 w-4" /> Configurer l&apos;IA
          </Link>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      {!config.configured ? (
        <Alert tone="warning" title="Aucune clé API configurée">
          Le Centre IA ne génère aucun texte sans fournisseur valide : aucune réponse n&apos;est simulée. Renseignez une clé
          dans{" "}
          <Link href="/app/settings?section=ai" className="font-semibold underline">
            Paramètres &gt; Intelligence artificielle
          </Link>{" "}
          pour activer la génération.
        </Alert>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader
            title="Nouvelle génération"
            subtitle="Décrivez précisément votre besoin : plus le brief est complet, plus le résultat est exploitable"
            icon="pen"
          />
          <form action={generateAiAction} className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="kind">Livrable attendu</label>
              <select id="kind" name="kind" className="input" defaultValue="facebook_post">
                {(Object.keys(AI_KINDS) as (keyof typeof AI_KINDS)[]).map((kind) => (
                  <option key={kind} value={kind}>{AI_KINDS[kind]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="platform">Plateforme (optionnel)</label>
              <select id="platform" name="platform" className="input" defaultValue="">
                <option value="">Non concerné</option>
                {(Object.keys(PLATFORMS) as (keyof typeof PLATFORMS)[]).map((platform) => (
                  <option key={platform} value={platform}>{PLATFORMS[platform]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tone">Ton éditorial</label>
              <select id="tone" name="tone" className="input" defaultValue="professionnel">
                {(Object.keys(EDITORIAL_TONES) as (keyof typeof EDITORIAL_TONES)[]).map((tone) => (
                  <option key={tone} value={EDITORIAL_TONES[tone]}>{EDITORIAL_TONES[tone]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="language">Langue de sortie</label>
              <select id="language" name="language" className="input" defaultValue="fr">
                {(Object.keys(AI_LANGUAGES) as (keyof typeof AI_LANGUAGES)[]).map((language) => (
                  <option key={language} value={language}>{AI_LANGUAGES[language]}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="brief">Brief *</label>
              <textarea
                id="brief"
                name="brief"
                rows={4}
                required
                minLength={3}
                maxLength={4000}
                className="input"
                placeholder="Ex. : annoncer l'ouverture de notre nouvelle boutique à Libreville, mettre en avant la livraison offerte cette semaine."
              />
            </div>
            <div>
              <label className="label" htmlFor="audience">Public cible</label>
              <input id="audience" name="audience" maxLength={500} className="input" placeholder="Jeunes actifs urbains, PME locales…" />
            </div>
            <div>
              <label className="label" htmlFor="keywords">Mots-clés à intégrer</label>
              <input id="keywords" name="keywords" maxLength={300} className="input" placeholder="ouverture, livraison offerte" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="businessContext">Contexte de l&apos;entreprise</label>
              <textarea
                id="businessContext"
                name="businessContext"
                rows={2}
                maxLength={2000}
                className="input"
                placeholder="Activité, positionnement, offres actuelles, éléments à ne pas mentionner…"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="sourceText">Texte source (correction, reformulation, traduction)</label>
              <textarea id="sourceText" name="sourceText" rows={4} maxLength={6000} className="input" placeholder="Collez ici le texte à retravailler" />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <p className="hint">
                Le texte est produit par {AI_PROVIDERS[config.provider].label} ({config.model}). Aucune donnée n&apos;est
                inventée : relisez toujours le résultat avant publication.
              </p>
              <button type="submit" className="btn btn-primary" disabled={!config.configured}>
                <Icon name="sparkles" className="h-4 w-4" /> Générer
              </button>
            </div>
          </form>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Fournisseur actif" icon="key" />
            <InfoRow label="Fournisseur" value={AI_PROVIDERS[config.provider].label} />
            <InfoRow label="Modèle" value={config.model} />
            <InfoRow label="Créativité" value={config.temperature} />
            <InfoRow
              label="Statut"
              value={config.configured ? <Badge status="connected">Opérationnel</Badge> : <Badge status="not_configured">Configuration requise</Badge>}
            />
            <InfoRow
              label="Origine de la clé"
              value={config.keySource === "company" ? "Entreprise" : config.keySource === "environment" ? "Serveur (éditeur)" : "Aucune"}
            />
            <p className="hint">{AI_PROVIDERS[config.provider].note}</p>
          </Card>

          <Card>
            <CardHeader title="Bonnes pratiques" icon="shield" />
            <ul className="ml-1 list-disc space-y-1 pl-4 text-[11.5px] text-ink-600">
              <li>Ne jamais publier un texte généré sans relecture humaine.</li>
              <li>Ne pas demander de chiffres, prix ou promesses non vérifiés.</li>
              <li>Vérifier les contraintes de chaque plateforme avant diffusion.</li>
              <li>Conserver une trace des validations dans le Studio de contenus.</li>
            </ul>
          </Card>
        </div>
      </div>

      {generation ? (
        <Card className="mt-3">
          <CardHeader
            title={`Résultat — ${labelOf(AI_KINDS, generation.kind)}`}
            subtitle={`${generation.provider ?? "—"} · ${generation.model ?? "—"} · ${formatDateTime(generation.created_at)}`}
            icon="sparkles"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={generation.output ?? ""} label="Copier le texte" />
                <form action={convertGenerationAction}>
                  <input type="hidden" name="id" value={generation.id} />
                  <button type="submit" className="btn btn-sm btn-primary">
                    <Icon name="pen" className="h-3.5 w-3.5" /> {generation.content_id ? "Ouvrir le contenu" : "Convertir en contenu"}
                  </button>
                </form>
                <form action={deleteGenerationAction}>
                  <input type="hidden" name="id" value={generation.id} />
                  <ConfirmSubmit message="Supprimer cette génération ?" />
                </form>
              </div>
            }
          />
          <pre className="whitespace-pre-wrap rounded-xl border border-ink-200 bg-ink-50/60 p-4 text-[12.5px] leading-relaxed text-ink-800">
            {generation.output}
          </pre>
          <p className="hint mt-2">Brief d&apos;origine : {generation.prompt ?? "—"}</p>
        </Card>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatCard label="Générations" value={totalGenerations} icon="sparkles" hint="Depuis la création de l'espace" />
        <StatCard label="30 derniers jours" value={last30} icon="calendar" />
        <StatCard label="Converties en contenus" value={converted} icon="pen" hint="Disponibles dans le Studio" />
      </div>

      <Card className="mt-3">
        <CardHeader title="Historique" subtitle="15 dernières générations de l'entreprise" icon="clock" />
        {history.length === 0 ? (
          <EmptyState
            icon="sparkles"
            title="Aucune génération"
            description="Utilisez le formulaire ci-dessus pour créer votre premier contenu assisté par IA."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Livrable</th>
                  <th>Brief</th>
                  <th>Fournisseur</th>
                  <th>Date</th>
                  <th>Contenu</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium text-ink-800">{labelOf(AI_KINDS, item.kind)}</td>
                    <td className="max-w-[320px] truncate text-[11.5px] text-ink-600">{item.prompt ?? "—"}</td>
                    <td className="text-[11px] text-ink-500">{item.provider ?? "—"}<br />{item.model ?? ""}</td>
                    <td className="text-[11px] text-ink-500">{formatDateTime(item.created_at)}</td>
                    <td>
                      {item.content_id ? (
                        <Link href={`/app/content/${item.content_id}`} className="badge bg-emerald-50 text-emerald-700 border-emerald-200">
                          Studio
                        </Link>
                      ) : (
                        <span className="text-[11px] text-ink-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Link href={`/app/ai?generation=${item.id}`} className="btn btn-sm">
                          <Icon name="eye" className="h-3.5 w-3.5" /> Voir
                        </Link>
                        <form action={deleteGenerationAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <ConfirmSubmit message="Supprimer ?" />
                        </form>
                      </div>
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
