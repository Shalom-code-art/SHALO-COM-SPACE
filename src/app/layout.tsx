import type { Metadata, Viewport } from "next";
import "./globals.css";

/** URL publique de l'instance (apercus reseaux sociaux, liens absolus). */
function metadataBase(): URL {
  const raw = process.env.APP_URL?.trim();
  try {
    return new URL(raw || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: {
    default: "SHALO COM SPACE — Communication digitale et marketing intelligent",
    template: "%s · SHALO COM SPACE",
  },
  description:
    "SHALO COM SPACE centralise la communication digitale des entreprises : contenus assistes par IA, réseaux sociaux, campagnes, contacts, catalogue et analytics. Édité par BATIANA TECH.",
  applicationName: "SHALO COM SPACE",
  authors: [{ name: "BATIANA TECH" }],
  creator: "BATIANA TECH",
  publisher: "BATIANA TECH",
  icons: {
    icon: "/brand/mark.png",
    apple: "/brand/mark.png",
  },
  openGraph: {
    title: "SHALO COM SPACE",
    description: "Communiquer · Créer · Partager · Développer — plateforme de communication digitale BATIANA TECH.",
    siteName: "SHALO COM SPACE",
    images: ["/brand/logo.png"],
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#122b52",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-ink-50 font-sans">{children}</body>
    </html>
  );
}
