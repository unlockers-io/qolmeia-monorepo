import { SignedInRedirect } from "@repo/app-shell/signed-in-redirect";
import type { Metadata } from "next";

import { RecoverForm } from "./recover-form";

export const metadata: Metadata = {
  title: "Recuperar senha",
};

const RecoverPage = () => (
  <>
    <SignedInRedirect />
    <RecoverForm />
  </>
);

export default RecoverPage;
