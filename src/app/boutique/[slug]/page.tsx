import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { get, all } from "@/lib/db";
import { PRODUCT_AVAILABILITY, formatMoney, labelOf } from "@/lib/format";
import { publicMediaUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

type ShopCompany = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  shop_enabled: number;
  shop_tagline: string | null;
  shop_about: string | null;
  status: string;
};

type ShopProduct = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  availability: string;
  featured: number;
  image_media_id: string | null;
  category_name: string | null;
};

async function loadCompany(slug: string): Promise<ShopCompany | null> {
  return get<ShopCompany>("SELECT * FROM companies WHERE slug = ? AND status = 'active'", [slug]);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const company = await loadCompany(slug);
  if (!company) return { title: "Vitrine introuvable" };
  return {
    title: `${company.name} — Vitrine officielle`,
    description: company.shop_tagline ?? `Catalogue de ${company.name}.`,
  };
}

export default async function PublicShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await loadCompany(slug);
  if (!company) notFound();

  if (!company.shop_enabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <div className="card card-pad max-w-md text-center">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon name="store" className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold text-ink-900">{company.name}</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            La vitrine publique de cette entreprise n&apos;est pas activée. Contactez l&apos;entreprise pour obtenir son catalogue.
          </p>
        </div>
      </main>
    );
  }

  const products = all<ShopProduct>(
    `SELECT p.id, p.kind, p.name, p.description, p.price_cents, p.currency, p.availability, p.featured,
            p.image_media_id, pc.name AS category_name
     FROM products p LEFT JOIN product_categories pc ON pc.id = p.category_id
     WHERE p.company_id = ? AND p.is_public = 1
     ORDER BY p.featured DESC, pc.position, p.name`,
    [company.id]
  );

  const groups = new Map<string, ShopProduct[]>();
  for (const product of products) {
    const key = product.category_name ?? "Autres offres";
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }

  const primary = /^#[0-9a-fA-F]{6}$/.test(company.primary_color) ? company.primary_color : "#0f2c52";
  const secondary = /^#[0-9a-fA-F]{6}$/.test(company.secondary_color) ? company.secondary_color : "#f97316";
  const phoneDigits = (company.phone ?? "").replace(/[^\d]/g, "");
  const location = [company.address, company.city, company.country].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="text-white" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 55%, ${secondary} 160%)` }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-14">
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <Image src={company.logo_url} alt={company.name} width={64} height={64} className="h-16 w-16 rounded-2xl bg-white/10 object-contain p-1" unoptimized />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-lg font-semibold">
                {company.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Vitrine officielle</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{company.name}</h1>
              {company.shop_tagline ? <p className="mt-1 max-w-xl text-[13px] text-white/80">{company.shop_tagline}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {phoneDigits ? (
              <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="btn bg-white text-ink-900 hover:bg-white/90">
                <Icon name="whatsapp" className="h-4 w-4" /> WhatsApp
              </a>
            ) : null}
            {company.email ? (
              <a href={`mailto:${company.email}`} className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20">
                <Icon name="mail" className="h-4 w-4" /> Écrire
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        {company.shop_about ? (
          <section className="card card-pad mb-6">
            <h2 className="card-title">À propos</h2>
            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-600">{company.shop_about}</p>
          </section>
        ) : null}

        {products.length === 0 ? (
          <div className="card card-pad text-center">
            <p className="text-sm font-medium text-ink-800">Le catalogue est en préparation</p>
            <p className="mt-1 text-[12.5px] text-ink-500">Aucune offre n&apos;est publiée pour le moment. Revenez bientôt ou contactez directement l&apos;entreprise.</p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([category, items]) => (
            <section key={category} className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-ink-900">{category}</h2>
                <span className="text-[11px] text-ink-400">{items.length} offre(s)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((product) => {
                  const image = publicMediaUrl(company.slug, product.image_media_id);
                  return (
                    <article key={product.id} className="card overflow-hidden">
                      <div className="grid h-40 place-items-center bg-ink-100">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <Icon name={product.kind === "service" ? "briefcase" : "store"} className="h-8 w-8 text-ink-300" />
                        )}
                      </div>
                      <div className="p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[13.5px] font-semibold text-ink-900">{product.name}</h3>
                          {product.featured ? (
                            <span className="badge border-accent-200 bg-accent-50 text-accent-600">Vedette</span>
                          ) : null}
                        </div>
                        {product.description ? (
                          <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink-500">{product.description}</p>
                        ) : null}
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold" style={{ color: primary }}>
                            {formatMoney(product.price_cents, product.currency)}
                          </p>
                          <span
                            className={
                              product.availability === "in_stock"
                                ? "badge border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "badge border-ink-200 bg-ink-50 text-ink-600"
                            }
                          >
                            {labelOf(PRODUCT_AVAILABILITY, product.availability)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <section className="card card-pad">
          <h2 className="card-title">Commander</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">
            Le paiement en ligne n&apos;est pas activé sur cette vitrine. Contactez directement l&apos;entreprise pour commander, obtenir un devis ou convenir d&apos;un rendez-vous.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {phoneDigits ? (
              <a href={`tel:${company.phone}`} className="btn btn-primary">
                <Icon name="phone" className="h-4 w-4" /> {company.phone}
              </a>
            ) : null}
            {company.email ? (
              <a href={`mailto:${company.email}`} className="btn">
                <Icon name="mail" className="h-4 w-4" /> {company.email}
              </a>
            ) : null}
            {company.website ? (
              <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="btn">
                <Icon name="globe" className="h-4 w-4" /> Site web
              </a>
            ) : null}
          </div>
          {location ? <p className="mt-3 text-[11.5px] text-ink-400">{location}</p> : null}
        </section>

        <footer className="mt-8 flex flex-col items-center gap-1 border-t border-ink-200 pt-5 text-center">
          <p className="text-[11.5px] text-ink-500">© {new Date().getFullYear()} {company.name}. Tous droits réservés.</p>
          <p className="text-[10.5px] text-ink-400">Vitrine propulsée par SHALO COM SPACE — BATIANA TECH</p>
        </footer>
      </div>
    </main>
  );
}
