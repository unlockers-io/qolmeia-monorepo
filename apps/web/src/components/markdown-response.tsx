"use client";

import { cn } from "@repo/ui/lib/utils";
import type { AnchorHTMLAttributes, ComponentProps, ImgHTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";

import { AssetImage } from "@/components/asset-image";

type ImgOverrideProps = ImgHTMLAttributes<HTMLImageElement> & { node?: unknown };

const PlainImage = ({ alt, className, src }: ImgOverrideProps) =>
  typeof src !== "string" || src === "" ? null : (
    <AssetImage
      alt={alt ?? ""}
      className={cn("h-auto max-h-80 w-auto rounded-md object-contain", className)}
      height={800}
      src={src}
      width={800}
    />
  );

type AnchorOverrideProps = AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown };

const PlainLink = ({ children, className, href }: AnchorOverrideProps) => (
  <a
    className={cn(
      "font-medium text-primary underline underline-offset-2 hover:text-primary/80",
      className,
    )}
    href={href}
    rel="noopener noreferrer"
    target="_blank"
  >
    {children}
  </a>
);

type StreamdownComponents = NonNullable<ComponentProps<typeof Streamdown>["components"]>;
const STREAMDOWN_COMPONENTS: StreamdownComponents = { a: PlainLink, img: PlainImage };

type MessageResponseProps = ComponentProps<typeof Streamdown>;

const MarkdownResponse = memo(
  ({ className, components, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      components={{ ...STREAMDOWN_COMPONENTS, ...components }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

MarkdownResponse.displayName = "MarkdownResponse";

export { MarkdownResponse };
