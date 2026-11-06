"use server";

import { revalidatePath } from "next/cache";
import { nowIso, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markNotificationsReadAction() {
  const user = await requireUser();
  run(
    "UPDATE notifications SET read_at = ? WHERE company_id = ? AND read_at IS NULL AND (user_id IS NULL OR user_id = ?)",
    [nowIso(), user.companyId, user.id]
  );
  revalidatePath("/app");
}

export async function markOneNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  run("UPDATE notifications SET read_at = ? WHERE id = ? AND company_id = ?", [nowIso(), id, user.companyId]);
  revalidatePath("/app");
}
