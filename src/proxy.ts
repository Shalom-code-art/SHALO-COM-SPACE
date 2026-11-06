import { NextResponse, type NextRequest } from "next/server";

/**
 * Protection de premier niveau des routes privees (convention `proxy` de Next 16).
 * Le controle d'acces reel (session, entreprise, permissions) est refait cote
 * serveur dans `requireUser` : ce filtre evite seulement un rendu inutile pour
 * un visiteur non authentifie.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get("shalo_session")?.value;
  const { pathname, search } = request.nextUrl;
  const isPrivate = pathname.startsWith("/app") || pathname.startsWith("/admin");

  if (isPrivate && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
