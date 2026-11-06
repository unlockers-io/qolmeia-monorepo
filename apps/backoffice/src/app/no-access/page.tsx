import { NoAccess } from "@repo/app-shell/no-access";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sem acesso",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const NoAccessPage = () => (
  <NoAccess
    description="Esta conta não tem papel de Operador (OWNER ou STAFF) nesta organização. Acesse o app do cliente ou peça ao dono para promover seu papel."
    title="Sem acesso ao painel"
  />
);

export default NoAccessPage;
