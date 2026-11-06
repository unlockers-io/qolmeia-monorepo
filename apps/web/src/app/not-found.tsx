import { NotFound } from "@repo/app-shell/not-found";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

const NotFoundPage = () => <NotFound homeLabel="Voltar ao chat" />;

export default NotFoundPage;
