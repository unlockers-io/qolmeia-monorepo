import "@/styles/globals.css";

import { bodyFont, fontVariables } from "@repo/app-shell/root-layout";
import { MAIN_CONTENT_ID, SkipLink } from "@repo/app-shell/skip-link";
import { displayName } from "@repo/identity";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SHORT_DESCRIPTION } from "@/lib/site";
import { SITE_URL } from "@/lib/urls";

export const metadata: Metadata = {
  authors: [{ name: displayName }],
  category: "technology",
  creator: displayName,
  description:
    "A Qolmeia monta um time de agentes de IA para a sua marca. Peça na conversa, acompanhe o trabalho e aprove as entregas.",
  keywords: ["qolmeia", "agentes de ia", "marketing", "marca", "campanhas"],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: SHORT_DESCRIPTION,
    locale: "pt_BR",
    siteName: displayName,
    title: `${displayName} · ${SHORT_DESCRIPTION}`,
    type: "website",
  },
  publisher: displayName,
  robots: {
    follow: true,
    googleBot: { follow: true, index: true },
    index: true,
  },
  title: {
    default: `${displayName} · ${SHORT_DESCRIPTION}`,
    template: `%s · ${displayName}`,
  },
  twitter: {
    card: "summary_large_image",
    description: SHORT_DESCRIPTION,
    title: `${displayName} · ${SHORT_DESCRIPTION}`,
  },
};

export { viewport } from "@repo/app-shell/root-layout";

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html className={`${fontVariables} scroll-smooth`} lang="pt-BR">
    <body className={`${bodyFont} flex min-h-dvh flex-col antialiased`}>
      <SkipLink />
      <Header />
      <main className="flex-1" id={MAIN_CONTENT_ID}>
        {children}
      </main>
      <Footer />
    </body>
  </html>
);

export default RootLayout;
