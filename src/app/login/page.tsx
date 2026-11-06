import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-panel";
import { Alert } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/server/actions/auth";

export const metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.isPlatformAdmin ? "/admin" : "/app");
  const params = await searchParams;

  return (
    <AuthLayout
      title="Connexion à votre espace"
      subtitle="Accédez à l'espace de communication de votre entreprise."
      footer={
        <>
          Pas encore d'espace ?{" "}
          <Link href="/register" className="font-medium text-brand-700 hover:underline">
            Créer l'espace de mon entreprise
          </Link>
        </>
      }
    >
      {params.error ? (
        <div className="mb-4">
          <Alert tone="error" title="Connexion impossible">
            {params.error}
          </Alert>
        </div>
      ) : null}
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={params.next ?? ""} />
        <div>
          <label className="label" htmlFor="email">
            Adresse email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            defaultValue={params.email ?? ""}
            className="input"
            placeholder="vous@entreprise.com"
          />
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
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          Se connecter
        </button>
      </form>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
        Mot de passe oublié ? Contactez l'administrateur principal de votre espace, il peut réinitialiser votre accès.
      </p>
    </AuthLayout>
  );
}
