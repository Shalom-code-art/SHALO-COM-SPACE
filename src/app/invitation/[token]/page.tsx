import Link from "next/link";
import { AuthLayout } from "@/components/auth-panel";
import { Alert } from "@/components/ui";
import { get } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { acceptInvitationAction } from "@/server/actions/auth";

export const metadata = { title: "Invitation" };
export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const invitation = get<{
    email: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
    company_name: string;
  }>(
    `SELECT i.email, i.role, i.expires_at, i.accepted_at, c.name AS company_name
     FROM invitations i JOIN companies c ON c.id = i.company_id
     WHERE i.token_hash = ?`,
    [sha256(token)]
  );

  const invalid = !invitation || invitation.accepted_at || new Date(invitation.expires_at).getTime() < Date.now();

  if (invalid) {
    return (
      <AuthLayout
        title="Invitation indisponible"
        subtitle="Ce lien d'invitation est invalide, déjà utilisé ou expiré."
        footer={
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Se connecter
          </Link>
        }
      >
        <Alert tone="warning" title="Lien non valable">
          Demandez à l'administrateur de votre espace de vous transmettre une nouvelle invitation.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Rejoindre ${invitation.company_name}`}
      subtitle={`Invitation pour ${invitation.email} — rôle : ${
        ROLE_LABELS[invitation.role as Role] ?? invitation.role
      }.`}
      footer={
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          J'ai déjà un compte
        </Link>
      }
    >
      {query.error ? (
        <div className="mb-4">
          <Alert tone="error" title="Inscription impossible">
            {query.error}
          </Alert>
        </div>
      ) : null}
      <form action={acceptInvitationAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="name">
            Votre nom complet
          </label>
          <input id="name" name="name" required minLength={2} className="input" placeholder="Nom et prénom" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Choisissez un mot de passe
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
        <button type="submit" className="btn btn-primary w-full">
          Rejoindre l'espace
        </button>
      </form>
    </AuthLayout>
  );
}
