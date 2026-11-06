import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-panel";
import { Alert } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { registerAction } from "@/server/actions/auth";

export const metadata = { title: "Créer un espace entreprise" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.isPlatformAdmin ? "/admin" : "/app");
  const params = await searchParams;

  return (
    <AuthLayout
      title="Créer l'espace de votre entreprise"
      subtitle="Un espace isolé, sécurisé et prêt à l'emploi pour votre équipe communication."
      footer={
        <>
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      {params.error ? (
        <div className="mb-4">
          <Alert tone="error" title="Inscription impossible">
            {params.error}
          </Alert>
        </div>
      ) : null}
      <form action={registerAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="companyName">
            Nom de l'entreprise
          </label>
          <input id="companyName" name="companyName" required minLength={2} className="input" placeholder="Ex. Batiana Media" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Votre nom complet
            </label>
            <input id="name" name="name" required minLength={2} className="input" placeholder="Nom et prénom" />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Téléphone (optionnel)
            </label>
            <input id="phone" name="phone" className="input" placeholder="+241 …" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">
            Adresse email professionnelle
          </label>
          <input id="email" name="email" type="email" required className="input" placeholder="vous@entreprise.com" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="city">
              Ville (optionnel)
            </label>
            <input id="city" name="city" className="input" placeholder="Libreville" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
              placeholder="8 caractères minimum"
            />
          </div>
        </div>
        <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-600">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 rounded border-ink-300" />
          <span>
            J'accepte la politique de confidentialité et le traitement des données de mon entreprise dans le cadre de
            l'utilisation de SHALO COM SPACE.
          </span>
        </label>
        <button type="submit" className="btn btn-primary w-full">
          Créer mon espace
        </button>
      </form>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
        Vous serez administrateur principal de cet espace et pourrez inviter vos collaborateurs.
      </p>
    </AuthLayout>
  );
}
