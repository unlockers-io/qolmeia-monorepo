import { createOpengraphImage } from "@repo/app-shell/opengraph-image";
import { displayName } from "@repo/identity";

import { SHORT_DESCRIPTION } from "@/lib/site";

export { OG_CONTENT_TYPE as contentType, OG_SIZE as size } from "@repo/app-shell/opengraph-image";

export const alt = `${displayName} · ${SHORT_DESCRIPTION}`;

export default createOpengraphImage({ subtitle: SHORT_DESCRIPTION, title: displayName });
