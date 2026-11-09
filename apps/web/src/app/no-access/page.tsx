import { NoAccess } from "@repo/app-shell/no-access";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sem acesso",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const NoAccessPage = () => (
  <NoAccess
    description="Esta conta não tem acesso ao chat do cliente. Acesse o painel operacional ou peça ao dono para criar um convite."
    title="Sem acesso ao chat"
  />
);

export default NoAccessPage;
