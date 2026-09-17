import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/urls";

const sitemap = (): MetadataRoute.Sitemap => [{ url: `${SITE_URL}/` }];

export default sitemap;
