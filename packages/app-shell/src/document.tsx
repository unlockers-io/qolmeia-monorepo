import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/compositions/theme-provider";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { bodyFont, fontVariables } from "./root-layout";
import { SkipLink } from "./skip-link";

/** Spread into the metadata of every root layout that renders `AppDocument`. */
const documentMetadata = {
  formatDetection: { telephone: false },
  other: { "msapplication-TileColor": "#000000" },
} satisfies Metadata;

const AppDocument = ({ children }: { children: ReactNode }) => (
  <html className={fontVariables} lang="pt-BR" suppressHydrationWarning>
    <body className={bodyFont} suppressHydrationWarning>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <SkipLink />
        {children}
        <Toaster containerAriaLabel="Notificações" />
      </ThemeProvider>
    </body>
  </html>
);

export { AppDocument, documentMetadata };
