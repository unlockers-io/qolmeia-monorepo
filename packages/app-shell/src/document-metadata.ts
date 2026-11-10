import type { Metadata } from "next";

/** Spread into the metadata of every root layout that renders `AppDocument`. */
const documentMetadata = {
  formatDetection: { telephone: false },
  other: { "msapplication-TileColor": "#000000" },
} satisfies Metadata;

export { documentMetadata };
