import { redirect } from "next/navigation";
import { AppShell, type ShellNotification } from "@/components/app-shell";
import { all } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.isPlatformAdmin) redirect("/admin");

  const notifications = all<ShellNotification>(
    `SELECT id, title, body, link, created_at, read_at, type
     FROM notifications
     WHERE company_id = ? AND (user_id IS NULL OR user_id = ?)
     ORDER BY created_at DESC
     LIMIT 8`,
    [user.companyId, user.id]
  );

  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
