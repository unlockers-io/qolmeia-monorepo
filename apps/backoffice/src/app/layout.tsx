import "@/styles/globals.css";

import { AppDocument } from "@repo/app-shell/document";
import { documentMetadata } from "@repo/app-shell/document-metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

const metadataBase =
  URL.parse(process.env.BACKOFFICE_URL ?? "") ?? new URL("https://admin.qolmeia.com");

export const metadata: Metadata = {
  ...documentMetadata,
  authors: [{ name: "Qolmeia" }],
  category: "technology",
  creator: "Qolmeia",
  description:
    "Painel operacional da Qolmeia. Atenda clientes com agentes de IA, aprove ações sensíveis e acompanhe a atividade do seu negócio em tempo real.",
  icons: {
    icon: "/favicon.ico",
  },
  keywords: ["qolmeia", "backoffice", "ai agency", "agentes"],
  metadataBase,
  openGraph: {
    description: "Painel operacional da Qolmeia.",
    locale: "pt_BR",
    siteName: "Qolmeia",
    title: "Qolmeia · Backoffice",
    type: "website",
  },
  publisher: "Qolmeia",
  robots: {
    follow: false,
    index: false,
  },
  title: {
    default: "Qolmeia · Backoffice",
    template: "%s · Qolmeia",
  },
  twitter: {
    card: "summary_large_image",
    description: "Painel operacional da Qolmeia.",
    title: "Qolmeia · Backoffice",
  },
};

export { viewport } from "@repo/app-shell/root-layout";

const RootLayout = ({ children }: { children: ReactNode }) => (
  <AppDocument>
    <Providers>{children}</Providers>
  </AppDocument>
);

export default RootLayout;
