"use client";

import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller";
import { ArrowDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "../lib/utils";

import { Button } from "./button";

const MessageScrollerProvider = (
  props: ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) => <MessageScrollerPrimitive.Provider {...props} />;

const MessageScroller = ({
  className,
  ...props
}: ComponentProps<typeof MessageScrollerPrimitive.Root>) => (
  <MessageScrollerPrimitive.Root
    className={cn(
      "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
      className,
    )}
    data-slot="message-scroller"
    {...props}
  />
);

const MessageScrollerViewport = ({
  className,
  ...props
}: ComponentProps<typeof MessageScrollerPrimitive.Viewport>) => (
  <MessageScrollerPrimitive.Viewport
    className={className}
    data-slot="message-scroller-viewport"
    {...props}
  />
);

const MessageScrollerContent = ({
  className,
  ...props
}: ComponentProps<typeof MessageScrollerPrimitive.Content>) => (
  <MessageScrollerPrimitive.Content
    className={className}
    data-slot="message-scroller-content"
    {...props}
  />
);

const MessageScrollerItem = ({
  className,
  scrollAnchor = false,
  ...props
}: ComponentProps<typeof MessageScrollerPrimitive.Item>) => (
  <MessageScrollerPrimitive.Item
    className={className}
    data-slot="message-scroller-item"
    scrollAnchor={scrollAnchor}
    {...props}
  />
);

type MessageScrollerButtonProps = ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<ComponentProps<typeof Button>, "size" | "variant">;

const MessageScrollerButton = ({
  children,
  className,
  direction = "end",
  render,
  size = "icon-sm",
  variant = "secondary",
  ...props
}: MessageScrollerButtonProps) => (
  <MessageScrollerPrimitive.Button
    className={className}
    data-direction={direction}
    data-size={size}
    data-slot="message-scroller-button"
    data-variant={variant}
    direction={direction}
    render={render ?? <Button size={size} variant={variant} />}
    {...props}
  >
    {children ?? (
      <>
        <ArrowDown aria-hidden />
        <span className="sr-only">
          {direction === "end" ? "Rolar para o fim" : "Rolar para o início"}
        </span>
      </>
    )}
  </MessageScrollerPrimitive.Button>
);

export {
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";

export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
};
