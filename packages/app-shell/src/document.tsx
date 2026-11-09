import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/compositions/theme-provider";
import type { ReactNode } from "react";

import { bodyFont, fontVariables } from "./root-layout";
import { SkipLink } from "./skip-link";

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

export { AppDocument };
