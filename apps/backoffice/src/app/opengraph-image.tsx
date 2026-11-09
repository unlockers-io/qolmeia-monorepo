import { createOpengraphImage } from "@repo/app-shell/opengraph-image";

export { OG_CONTENT_TYPE as contentType, OG_SIZE as size } from "@repo/app-shell/opengraph-image";

export const alt = "Qolmeia · Backoffice";

export default createOpengraphImage({
  subtitle: "Painel operacional da Qolmeia.",
  title: "Qolmeia",
});
