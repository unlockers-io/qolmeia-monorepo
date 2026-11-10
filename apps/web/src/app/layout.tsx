import "@/styles/globals.css";

import { AppDocument } from "@repo/app-shell/document";
import { documentMetadata } from "@repo/app-shell/document-metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

const metadataBase = URL.parse(process.env.WEB_APP_URL ?? "") ?? new URL("https://app.qolmeia.com");

export const metadata: Metadata = {
  ...documentMetadata,
  authors: [{ name: "Qolmeia" }],
  category: "technology",
  creator: "Qolmeia",
  description:
    "Converse com os agentes de IA da Qolmeia para criar materiais de marca, agendar campanhas e acompanhar o trabalho em tempo real.",
  keywords: ["qolmeia", "chat", "ai", "clientes"],
  metadataBase,
  openGraph: {
    description: "Chat com os agentes de IA da Qolmeia.",
    locale: "pt_BR",
    siteName: "Qolmeia",
    title: "Qolmeia · Chat",
    type: "website",
  },
  publisher: "Qolmeia",
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
