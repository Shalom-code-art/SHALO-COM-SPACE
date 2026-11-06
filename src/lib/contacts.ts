/**
 * Regles metier des contacts (Module 07), partagees par les Server Actions.
 *
 * Ce module est volontairement hors de `server/actions` : un fichier `"use server"`
 * ne peut exporter que des fonctions asynchrones.
 */

import { all } from "@/lib/db";

export function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/** Detection des doublons : telephone (chiffres) ou email identiques. */
export function findDuplicate(
  companyId: string,
  kind: string,
  input: { phone?: string | null; whatsapp?: string | null; email?: string | null },
  excludeId?: string
): { id: string; name: string } | null {
  const email = (input.email ?? "").trim().toLowerCase();
  const phones = [digits(input.phone), digits(input.whatsapp)].filter((value) => value.length >= 6);
  const candidates = all<{ id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null }>(
    "SELECT id, name, phone, whatsapp, email FROM contacts WHERE company_id = ? AND kind = ?",
    [companyId, kind]
  );
  for (const candidate of candidates) {
    if (excludeId && candidate.id === excludeId) continue;
    if (email && (candidate.email ?? "").toLowerCase() === email) return { id: candidate.id, name: candidate.name };
    const candidatePhones = [digits(candidate.phone), digits(candidate.whatsapp)].filter(Boolean);
    if (phones.some((phone) => candidatePhones.includes(phone))) return { id: candidate.id, name: candidate.name };
  }
  return null;
}
