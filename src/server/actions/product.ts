"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientIp, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { get, newId, nowIso, run } from "@/lib/db";
import { productSchema, zodMessage } from "@/lib/validation";

function enc(value: string) {
  return encodeURIComponent(value);
}

function catalogUrl(url: string) {
  return `/app/catalog?${url}`;
}

/** Cree ou met a jour un produit ou un service du catalogue (Module 08). */
export async function saveProductAction(formData: FormData) {
  const user = await requireUser("catalog.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.safeParse({
    kind: formData.get("kind") ?? "product",
    name: formData.get("name"),
    sku: formData.get("sku") ?? "",
    categoryId: formData.get("categoryId") ? String(formData.get("categoryId")) : null,
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? 0,
    currency: formData.get("currency") ?? "XAF",
    availability: formData.get("availability") ?? "in_stock",
    featured: formData.get("featured") === "on",
    isPublic: formData.get("isPublic") === "on",
    imageMediaId: formData.get("imageMediaId") ? String(formData.get("imageMediaId")) : null,
  });
  if (!parsed.success) redirect(catalogUrl(`error=${enc(zodMessage(parsed.error))}`));
  const data = parsed.data;

  if (data.categoryId) {
    const category = get<{ id: string }>("SELECT id FROM product_categories WHERE id = ? AND company_id = ?", [
      data.categoryId,
      companyId,
    ]);
    if (!category) redirect(catalogUrl(`error=${enc("Catégorie introuvable.")}`));
  }
  if (data.imageMediaId) {
    const image = get<{ id: string }>("SELECT id FROM media WHERE id = ? AND company_id = ?", [data.imageMediaId, companyId]);
    if (!image) redirect(catalogUrl(`error=${enc("Visuel introuvable dans la médiathèque.")}`));
  }

  const priceCents = Math.round(Number(data.price) * 100);

  if (id) {
    const existing = get<{ id: string }>("SELECT id FROM products WHERE id = ? AND company_id = ?", [id, companyId]);
    if (!existing) redirect(catalogUrl(`error=${enc("Élément introuvable.")}`));
    run(
      `UPDATE products SET kind = ?, name = ?, sku = ?, category_id = ?, description = ?, price_cents = ?, currency = ?,
         image_media_id = ?, availability = ?, featured = ?, is_public = ?, updated_at = ?
       WHERE id = ? AND company_id = ?`,
      [
        data.kind,
        data.name,
        data.sku || null,
        data.categoryId ?? null,
        data.description || null,
        priceCents,
        data.currency,
        data.imageMediaId ?? null,
        data.availability,
        data.featured ? 1 : 0,
        data.isPublic ? 1 : 0,
        nowIso(),
        id,
        companyId,
      ]
    );
    logAudit({ companyId, actor: user, action: "product.updated", entity: "product", entityId: id, details: data.name, ip: await clientIp() });
  } else {
    const productId = newId();
    run(
      `INSERT INTO products (id, company_id, kind, name, sku, category_id, description, price_cents, currency,
         image_media_id, availability, featured, is_public, position, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        productId,
        companyId,
        data.kind,
        data.name,
        data.sku || null,
        data.categoryId ?? null,
        data.description || null,
        priceCents,
        data.currency,
        data.imageMediaId ?? null,
        data.availability,
        data.featured ? 1 : 0,
        data.isPublic ? 1 : 0,
        0,
        nowIso(),
        nowIso(),
      ]
    );
    logAudit({ companyId, actor: user, action: "product.created", entity: "product", entityId: productId, details: data.name, ip: await clientIp() });
  }

  revalidatePath("/app/catalog");
  redirect(catalogUrl(`saved=${enc(id ? "Élément enregistré" : "Élément créé")}&kind=${data.kind}`));
}

export async function deleteProductAction(formData: FormData) {
  const user = await requireUser("catalog.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const product = get<{ name: string }>("SELECT name FROM products WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!product) redirect(catalogUrl(`error=${enc("Élément introuvable.")}`));
  run("DELETE FROM products WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({ companyId, actor: user, action: "product.deleted", entity: "product", entityId: id, details: product.name, ip: await clientIp() });
  revalidatePath("/app/catalog");
  redirect(catalogUrl(`saved=${enc("Élément supprimé")}`));
}

export async function toggleProductVisibilityAction(formData: FormData) {
  const user = await requireUser("catalog.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const field = String(formData.get("field") ?? "is_public");
  if (!["is_public", "featured"].includes(field)) {
    redirect(catalogUrl(`error=${enc("Champ non autorisé.")}`));
  }
  const product = get<{ name: string; is_public: number; featured: number }>(
    "SELECT name, is_public, featured FROM products WHERE id = ? AND company_id = ?",
    [id, companyId]
  );
  if (!product) redirect(catalogUrl(`error=${enc("Élément introuvable.")}`));
  const current = field === "is_public" ? Number(product.is_public) : Number(product.featured);
  run(`UPDATE products SET ${field} = ?, updated_at = ? WHERE id = ? AND company_id = ?`, [
    current ? 0 : 1,
    nowIso(),
    id,
    companyId,
  ]);
  logAudit({
    companyId,
    actor: user,
    action: "product.visibility",
    entity: "product",
    entityId: id,
    details: `${product.name} · ${field}=${current ? 0 : 1}`,
    ip: await clientIp(),
  });
  revalidatePath("/app/catalog");
  revalidatePath("/boutique");
  redirect(catalogUrl(`saved=${enc("Catalogue mis à jour")}`));
}

export async function saveCategoryAction(formData: FormData) {
  const user = await requireUser("catalog.manage");
  const companyId = user.companyId!;
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) redirect(catalogUrl(`error=${enc("Nom de catégorie trop court.")}`));
  const duplicate = get<{ id: string }>(
    "SELECT id FROM product_categories WHERE company_id = ? AND LOWER(name) = LOWER(?)",
    [companyId, name]
  );
  if (duplicate) redirect(catalogUrl(`error=${enc("Cette catégorie existe déjà.")}`));
  const id = newId();
  run("INSERT INTO product_categories (id, company_id, name, position) VALUES (?,?,?,?)", [
    id,
    companyId,
    name,
    Date.now(),
  ]);
  logAudit({ companyId, actor: user, action: "product_category.created", entity: "product_category", entityId: id, details: name, ip: await clientIp() });
  revalidatePath("/app/catalog");
  redirect(catalogUrl(`saved=${enc("Catégorie créée")}`));
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requireUser("catalog.manage");
  const companyId = user.companyId!;
  const id = String(formData.get("id") ?? "");
  const category = get<{ name: string }>("SELECT name FROM product_categories WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!category) redirect(catalogUrl(`error=${enc("Catégorie introuvable.")}`));
  run("DELETE FROM product_categories WHERE id = ? AND company_id = ?", [id, companyId]);
  logAudit({ companyId, actor: user, action: "product_category.deleted", entity: "product_category", entityId: id, details: category.name, ip: await clientIp() });
  revalidatePath("/app/catalog");
  redirect(catalogUrl(`saved=${enc("Catégorie supprimée")}`));
}
