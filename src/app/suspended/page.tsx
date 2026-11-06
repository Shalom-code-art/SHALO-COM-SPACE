import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/server/actions/auth";

export const metadata = { title: "Espace suspendu" };
export const dynamic = "force-dynamic";

/**
 * Ecran affiche lorsqu'une entreprise n'est plus active.
 * Aucune donnee metier n'est rendue ici : seuls l'identite et le statut sont lus.
 */
export default async function SuspendedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isPlatformAdmin) redirect("/admin");
  if (!user.company) redirect("/login");
  if (user.company.status === "active") redirect("/app");

  const company = user.company;

  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-900 text-white">
            <Icon name="lock" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink-900">SHALO COM SPACE</p>
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-ink-400">BATIANA TECH</p>
          </div>
        </div>

        <section className="card card-pad">
          <h1 className="text-lg font-semibold text-ink-900">Accès à l&apos;espace suspendu</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
            L&apos;espace de <strong>{company.name}</strong> n&apos;est plus actif. Les données restent conservées et
            pourront être restaurées dès la régularisation de la situation.
          </p>

          <dl className="mt-4 space-y-2 rounded-xl border border-ink-200 bg-ink-50/70 p-3 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Statut de l&apos;entreprise</dt>
              <dd className="font-medium text-ink-800">{company.status}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Statut de l&apos;abonnement</dt>
              <dd className="font-medium text-ink-800">{company.subscription_status}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Formule</dt>
              <dd className="font-medium text-ink-800">{company.plan}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500">Compte connecté</dt>
              <dd className="font-medium text-ink-800">{user.email}</dd>
            </div>
          </dl>

          <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
            Contactez BATIANA TECH pour connaître le motif exact et les modalités de réactivation. Aucune donnée n&apos;a été
            supprimée.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <form action={logoutAction}>
              <button type="submit" className="btn btn-primary">
                <Icon name="logout" className="h-4 w-4" /> Se déconnecter
              </button>
            </form>
            <Link href="/" className="btn">
              <Icon name="globe" className="h-4 w-4" /> Retour au site
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
