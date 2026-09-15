import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { type ButtonVariantProps, buttonVariants } from "../lib/button-variants";
import { cn } from "../lib/utils";

const Button = ({
  className,
  rounded = false,
  size = "default",
  variant = "default",
  ...props
}: ButtonPrimitive.Props & ButtonVariantProps & { rounded?: boolean }) => (
  <ButtonPrimitive
    className={cn(buttonVariants({ size, variant }), rounded && "rounded-lg", className)}
    data-slot="button"
    {...props}
  />
);

export { Button };
