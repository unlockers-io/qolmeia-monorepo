import { createOpengraphImage } from "@repo/app-shell/opengraph-image";

import { SHORT_DESCRIPTION, SITE_NAME } from "@/lib/site";

export { OG_CONTENT_TYPE as contentType, OG_SIZE as size } from "@repo/app-shell/opengraph-image";

export const alt = `${SITE_NAME} · ${SHORT_DESCRIPTION}`;

export default createOpengraphImage({ subtitle: SHORT_DESCRIPTION, title: SITE_NAME });
