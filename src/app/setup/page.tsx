import Link from "next/link";
import { AuthLayout } from "@/components/auth-panel";
import { Alert } from "@/components/ui";
import { count } from "@/lib/db";
import { bootstrapPlatformAdminAction } from "@/server/actions/auth";

export const metadata = { title: "Installation de la plateforme" };
export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const admins = count("SELECT COUNT(*) AS n FROM users WHERE role = 'platform_admin'");

  if (admins > 0) {
    return (
      <AuthLayout
        title="Plateforme déjà installée"
        subtitle="Un administrateur BATIANA TECH existe déjà sur cette instance."
        footer={
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Se connecter à la console plateforme
          </Link>
        }
      >
        <Alert tone="info" title="Aucune action requise">
          Pour créer un second administrateur plateforme, connectez-vous avec un compte existant puis
          ajoutez-le depuis la console BATIANA TECH.
        </Alert>
        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
          Cette page est réservée au premier démarrage. Elle ne permet pas de créer un compte une fois
          l'installation terminée.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer l'administrateur plateforme"
      subtitle="Compte BATIANA TECH de supervision : il gère les entreprises clientes, leurs accès et leurs abonnements, sans accès automatique à leurs contenus privés."
      footer={
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          J'ai déjà un compte
        </Link>
      }
    >
      {params.error ? (
        <div className="mb-4">
          <Alert tone="error" title="Création impossible">
            {params.error}
          </Alert>
        </div>
      ) : null}
      <form action={bootstrapPlatformAdminAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Nom complet
          </label>
          <input id="name" name="name" required minLength={2} className="input" placeholder="Administrateur BATIANA TECH" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Adresse email
          </label>
          <input id="email" name="email" type="email" required className="input" placeholder="admin@batianatech.com" />
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
            minLength={10}
            autoComplete="new-password"
            className="input"
            placeholder="10 caractères minimum"
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          Créer le compte et ouvrir la console
        </button>
      </form>
      <AuthHint />
    </AuthLayout>
  );
}

function AuthHint() {
  return (
    <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
      Les entreprises clientes créent ensuite leur propre espace depuis la page d'inscription : chaque espace
      est isolé et son administrateur principal gère ses utilisateurs et permissions.
    </p>
  );
}
