import "@/styles/globals.css";

import { AppDocument } from "@repo/app-shell/document";
import { documentMetadata } from "@repo/app-shell/document-metadata";
import { displayName, origins } from "@repo/identity";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

const metadataBase = URL.parse(process.env.WEB_APP_URL ?? "") ?? new URL(origins.web);

export const metadata: Metadata = {
  ...documentMetadata,
  authors: [{ name: displayName }],
  category: "technology",
  creator: displayName,
  description:
    "Converse com os agentes de IA da Qolmeia para criar materiais de marca, agendar campanhas e acompanhar o trabalho em tempo real.",
  keywords: ["qolmeia", "chat", "ai", "clientes"],
  metadataBase,
  openGraph: {
    description: "Chat com os agentes de IA da Qolmeia.",
    locale: "pt_BR",
    siteName: displayName,
    title: "Qolmeia · Chat",
    type: "website",
  },
  publisher: displayName,
  robots: {
    follow: false,
    index: false,
  },
  title: {
    default: "Qolmeia · Chat",
    template: "%s · Qolmeia",
  },
  twitter: {
    card: "summary_large_image",
    description: "Chat com os agentes de IA da Qolmeia.",
    title: "Qolmeia · Chat",
  },
};

export { viewport } from "@repo/app-shell/root-layout";

const RootLayout = ({ children }: { children: ReactNode }) => (
  <AppDocument>
    <Providers>{children}</Providers>
  </AppDocument>
);

export default RootLayout;
