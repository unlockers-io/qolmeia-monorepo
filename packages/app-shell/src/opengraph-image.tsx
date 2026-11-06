import { svgText } from "@repo/social-image";
import { ImageResponse } from "next/og";

const OG_SIZE = { height: 630, width: 1200 };

const OG_CONTENT_TYPE = "image/png";

const COLORS = { background: "#f9f8f5", foreground: "#1f1c1a", mutedForeground: "#746d68" };

const createOpengraphImage =
  ({ subtitle, title }: { subtitle: string; title: string }) =>
  () =>
    new ImageResponse(
      <svg height={630} viewBox="0 0 1200 630" width={1200}>
        <rect fill={COLORS.background} height={630} width={1200} />
        {svgText(title, {
          anchor: "middle",
          color: COLORS.foreground,
          size: 96,
          tracking: -2.4,
          x: 600,
          y: 309,
        })}
        {svgText(subtitle, {
          anchor: "middle",
          color: COLORS.mutedForeground,
          size: 40,
          width: 1040,
          x: 600,
          y: 389,
        })}
      </svg>,
      OG_SIZE,
    );

export { createOpengraphImage, OG_CONTENT_TYPE, OG_SIZE };
