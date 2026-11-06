import Link from "next/link";
import { ConfirmSubmit, Disclosure } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Badge, Card, CardHeader, EmptyState, Flash, PageHeader, StatCard, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { PRODUCT_AVAILABILITY, formatDate, formatMoney, labelOf } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { deleteCategoryAction, deleteProductAction, saveCategoryAction, saveProductAction, toggleProductVisibilityAction } from "@/server/actions/product";

export const metadata = { title: "Catalogue & boutique" };

const CURRENCIES = ["XAF", "EUR", "USD", "XOF"];

function ProductFields({
  product,
  categories,
  images,
}: {
  product?: Record<string, unknown>;
  categories: { id: string; name: string }[];
  images: { id: string; name: string }[];
}) {
  const value = (key: string) => String(product?.[key] ?? "");
  return (
    <>
      <div>
        <label className="label" htmlFor="kind">Nature *</label>
        <select id="kind" name="kind" defaultValue={value("kind") || "product"} className="input">
          <option value="product">Produit</option>
          <option value="service">Service</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="name">Nom *</label>
        <input id="name" name="name" required defaultValue={value("name")} className="input" placeholder="Ex. Pack communication 3 mois" />
      </div>
      <div>
        <label className="label" htmlFor="sku">Référence interne</label>
        <input id="sku" name="sku" defaultValue={value("sku")} className="input" placeholder="SKU-001" />
      </div>
      <div>
        <label className="label" htmlFor="categoryId">Catégorie</label>
        <select id="categoryId" name="categoryId" defaultValue={value("category_id")} className="input">
          <option value="">Non classé</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="price">Prix (unitaire)</label>
        <input id="price" name="price" type="number" min="0" step="0.01" defaultValue={String(Number(product?.price_cents ?? 0) / 100)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="currency">Devise</label>
        <select id="currency" name="currency" defaultValue={value("currency") || "XAF"} className="input">
          {CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="availability">Disponibilité</label>
        <select id="availability" name="availability" defaultValue={value("availability") || "in_stock"} className="input">
          {Object.entries(PRODUCT_AVAILABILITY).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="imageMediaId">Visuel (médiathèque)</label>
        <select id="imageMediaId" name="imageMediaId" defaultValue={value("image_media_id")} className="input">
          <option value="">Aucun visuel</option>
          {images.map((image) => (
            <option key={image.id} value={image.id}>{image.name}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} defaultValue={value("description")} className="input" placeholder="Bénéfices, contenu, conditions…" />
      </div>
      <div className="md:col-span-2 flex flex-wrap gap-4 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
        <label className="flex items-center gap-2 text-[12px] text-ink-700">
          <input type="checkbox" name="isPublic" defaultChecked={product ? Boolean(Number(product.is_public)) : true} className="h-3.5 w-3.5" />
          Visible sur la vitrine publique
        </label>
        <label className="flex items-center gap-2 text-[12px] text-ink-700">
          <input type="checkbox" name="featured" defaultChecked={Boolean(Number(product?.featured ?? 0))} className="h-3.5 w-3.5" />
          Mettre en avant
        </label>
      </div>
    </>
  );
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; edit?: string; category?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("catalog.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const canManage = user.permissions.includes("catalog.manage");

  const categories = all<{ id: string; name: string; total: number }>(
    `SELECT pc.id, pc.name, (SELECT COUNT(*) FROM products p WHERE p.category_id = pc.id) AS total
     FROM product_categories pc WHERE pc.company_id = ? ORDER BY pc.position, pc.name`,
    [companyId]
  );
  const images = all<{ id: string; name: string }>(
    "SELECT id, name FROM media WHERE company_id = ? AND kind = 'image' ORDER BY created_at DESC LIMIT 100",
    [companyId]
  );

  const where = ["p.company_id = ?"];
  const args: unknown[] = [companyId];
  if (query.kind === "product" || query.kind === "service") {
    where.push("p.kind = ?");
    args.push(query.kind);
  }
  if (query.category) {
    where.push("p.category_id = ?");
    args.push(query.category);
  }

  const products = all<{
    id: string;
    kind: string;
    name: string;
    sku: string | null;
    description: string | null;
    price_cents: number;
    currency: string;
    availability: string;
    featured: number;
    is_public: number;
    image_media_id: string | null;
    category_name: string | null;
    updated_at: string;
  }>(
    `SELECT p.id, p.kind, p.name, p.sku, p.description, p.price_cents, p.currency, p.availability, p.featured,
            p.is_public, p.image_media_id, pc.name AS category_name, p.updated_at
     FROM products p LEFT JOIN product_categories pc ON pc.id = p.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.featured DESC, p.name LIMIT 200`,
    args
  );

  const editing = query.edit
    ? get<Record<string, unknown>>("SELECT * FROM products WHERE id = ? AND company_id = ?", [query.edit, companyId])
    : null;

  const totals = get<{ products: number; services: number; public_count: number; featured: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'product' THEN 1 ELSE 0 END), 0) AS products,
       COALESCE(SUM(CASE WHEN kind = 'service' THEN 1 ELSE 0 END), 0) AS services,
       COALESCE(SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END), 0) AS public_count,
       COALESCE(SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END), 0) AS featured
     FROM products WHERE company_id = ?`,
    [companyId]
  ) ?? { products: 0, services: 0, public_count: 0, featured: 0 };

  const shopUrl = user.company ? `/boutique/${user.company.slug}` : null;

  return (
    <>
      <PageHeader
        title="Catalogue & boutique"
        subtitle="Produits, services, catégories, prix et vitrine publique de l'entreprise. Paiement en ligne non activé dans cette version."
        icon="store"
        actions={
          shopUrl ? (
            <Link href={shopUrl} target="_blank" className="btn">
              <Icon name="external" className="h-4 w-4" /> Voir la vitrine publique
            </Link>
          ) : null
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produits" value={totals.products} icon="store" tone="brand" />
        <StatCard label="Services" value={totals.services} icon="briefcase" tone="sky" />
        <StatCard label="Visibles en vitrine" value={totals.public_count} icon="globe" tone="emerald" />
        <StatCard label="Mis en avant" value={totals.featured} icon="star" tone="accent" />
      </div>

      <div className="mt-4">
        <Tabs
          items={[
            { label: "Tout le catalogue", href: "/app/catalog", active: !query.kind, count: totals.products + totals.services },
            { label: "Produits", href: "/app/catalog?kind=product", active: query.kind === "product", count: totals.products },
            { label: "Services", href: "/app/catalog?kind=service", active: query.kind === "service", count: totals.services },
          ]}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader title="Catégories" subtitle="Organisation de la vitrine" icon="layers" />
          {categories.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucune catégorie. Créez-en une pour classer vos produits et services.</p>
          ) : (
            <ul className="space-y-1">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-2.5 py-1.5">
                  <Link href={`/app/catalog?category=${category.id}`} className="text-[12px] font-medium text-ink-800 hover:text-brand-700">
                    {category.name} <span className="text-[10.5px] font-normal text-ink-400">({category.total})</span>
                  </Link>
                  {canManage ? (
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <ConfirmSubmit message="Supprimer cette catégorie ?" className="btn btn-sm btn-ghost">
                        Retirer
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <form action={saveCategoryAction} className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="category-name">Nouvelle catégorie</label>
                <input id="category-name" name="name" required className="input" placeholder="Ex. Formations" />
              </div>
              <button type="submit" className="btn btn-primary">
                <Icon name="plus" className="h-4 w-4" /> Ajouter
              </button>
            </form>
          ) : null}
          {query.category ? (
            <Link href="/app/catalog" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-brand-700 hover:underline">
              <Icon name="close" className="h-3 w-3" /> Retirer le filtre de catégorie
            </Link>
          ) : null}
        </Card>

        <div className="space-y-3">
          {canManage ? (
            <Disclosure title="Nouveau produit ou service">
              <form action={saveProductAction} className="card card-pad grid gap-3 md:grid-cols-2">
                <ProductFields categories={categories} images={images} />
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" className="btn btn-primary">
                    <Icon name="check" className="h-4 w-4" /> Ajouter au catalogue
                  </button>
                </div>
              </form>
            </Disclosure>
          ) : null}

          {editing ? (
            <Card>
              <CardHeader
                title={`Modifier : ${String(editing.name)}`}
                subtitle="Les changements sont appliqués immédiatement à la vitrine"
                icon="edit"
                action={
                  <Link href="/app/catalog" className="btn btn-sm">
                    <Icon name="close" className="h-3.5 w-3.5" /> Fermer
                  </Link>
                }
              />
              <form action={saveProductAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={String(editing.id)} />
                <ProductFields product={editing} categories={categories} images={images} />
                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-ink-400">Dernière mise à jour : {formatDate(String(editing.updated_at), true)}</p>
                  <button type="submit" className="btn btn-primary">
                    <Icon name="check" className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Éléments du catalogue" subtitle={`${products.length} élément(s)`} icon="store" />
            {products.length === 0 ? (
              <EmptyState
                icon="store"
                title="Catalogue vide"
                description="Ajoutez vos produits et services pour construire la vitrine publique de l'entreprise."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Élément</th>
                      <th>Catégorie</th>
                      <th>Prix</th>
                      <th>Disponibilité</th>
                      <th>Vitrine</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            {product.image_media_id ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={mediaUrl(product.image_media_id) ?? ""}
                                alt={product.name}
                                className="h-9 w-9 rounded-lg border border-ink-200 object-cover"
                              />
                            ) : (
                              <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-100 text-ink-400">
                                <Icon name={product.kind === "service" ? "briefcase" : "store"} className="h-4 w-4" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-[12.5px] font-medium text-ink-900">{product.name}</p>
                              <p className="text-[10.5px] text-ink-400">
                                {product.kind === "service" ? "Service" : "Produit"}
                                {product.sku ? ` · ${product.sku}` : ""}
                                {product.featured ? " · mis en avant" : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-[12px] text-ink-600">{product.category_name ?? "—"}</td>
                        <td className="text-[12px] font-medium text-ink-800">{formatMoney(product.price_cents, product.currency)}</td>
                        <td><Badge status={product.availability}>{labelOf(PRODUCT_AVAILABILITY, product.availability)}</Badge></td>
                        <td>
                          {product.is_public ? (
                            <Badge status="approved">Publique</Badge>
                          ) : (
                            <Badge status="cancelled">Masquée</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Link href={`/app/catalog?edit=${product.id}${query.kind ? `&kind=${query.kind}` : ""}`} className="btn btn-sm">
                              <Icon name="edit" className="h-3.5 w-3.5" /> Modifier
                            </Link>
                            {canManage ? (
                              <>
                                <form action={toggleProductVisibilityAction}>
                                  <input type="hidden" name="id" value={product.id} />
                                  <input type="hidden" name="field" value="is_public" />
                                  <button type="submit" className="btn btn-sm">
                                    {product.is_public ? "Masquer" : "Publier"}
                                  </button>
                                </form>
                                <form action={toggleProductVisibilityAction}>
                                  <input type="hidden" name="id" value={product.id} />
                                  <input type="hidden" name="field" value="featured" />
                                  <button type="submit" className="btn btn-sm">
                                    {product.featured ? "Retirer vedette" : "Mettre en avant"}
                                  </button>
                                </form>
                                <form action={deleteProductAction}>
                                  <input type="hidden" name="id" value={product.id} />
                                  <ConfirmSubmit message="Supprimer ?">Supprimer</ConfirmSubmit>
                                </form>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
