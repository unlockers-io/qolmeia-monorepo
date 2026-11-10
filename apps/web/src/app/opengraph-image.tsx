import { createOpengraphImage } from "@repo/app-shell/opengraph-image";

export { OG_CONTENT_TYPE as contentType, OG_SIZE as size } from "@repo/app-shell/opengraph-image";

export const alt = "Qolmeia · Chat";

export default createOpengraphImage({
  subtitle: "Chat com os agentes de IA da Qolmeia.",
  title: "Qolmeia",
});
