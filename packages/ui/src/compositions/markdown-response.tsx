"use client";

import type { AnchorHTMLAttributes, ComponentProps, ImgHTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";

import { cn } from "../lib/utils";

import { AssetImage } from "./asset-image";

type ImgOverrideProps = ImgHTMLAttributes<HTMLImageElement> & { node?: unknown };

const DELIVERED_IMAGE_ALT = "Imagem entregue pelo Time";

const renderImage = ({ alt, className, src }: ImgOverrideProps, loading: "eager" | "lazy") =>
  typeof src !== "string" || src === "" ? null : (
    <AssetImage
      alt={alt === undefined || alt === "" ? DELIVERED_IMAGE_ALT : alt}
      className={cn("h-auto max-h-80 w-auto rounded-md object-contain", className)}
      height={800}
      loading={loading}
      src={src}
      width={800}
    />
  );

const LazyImage = (props: ImgOverrideProps) => renderImage(props, "lazy");

const EagerImage = (props: ImgOverrideProps) => renderImage(props, "eager");

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
const LAZY_COMPONENTS: StreamdownComponents = { a: PlainLink, img: LazyImage };
const EAGER_COMPONENTS: StreamdownComponents = { a: PlainLink, img: EagerImage };

type MessageResponseProps = ComponentProps<typeof Streamdown> & { eagerImages?: boolean };

const MarkdownResponse = memo(
  ({ className, components, eagerImages = false, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn("w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      components={{ ...(eagerImages ? EAGER_COMPONENTS : LAZY_COMPONENTS), ...components }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

MarkdownResponse.displayName = "MarkdownResponse";

export { MarkdownResponse };
