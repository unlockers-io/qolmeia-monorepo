import { ImageResponse } from "next/og";
import { createElement } from "react";

import { OpengraphCard, type OpengraphCardProps } from "./opengraph-card";

const OG_SIZE = { height: 630, width: 1200 };

const OG_CONTENT_TYPE = "image/png";

const createOpengraphImage = (card: OpengraphCardProps) => () =>
  new ImageResponse(createElement(OpengraphCard, card), OG_SIZE);

export { createOpengraphImage, OG_CONTENT_TYPE, OG_SIZE };
