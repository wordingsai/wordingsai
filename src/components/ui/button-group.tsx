import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

const buttonGroupVariants = cva("flex", {
  variants: {
    orientation: {
      horizontal: "flex-row",
      vertical: "flex-col",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});

export interface ButtonGroupProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupVariants> {}

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation, ...props }, ref) => (
    <div
      className={cn(buttonGroupVariants({ orientation }), className)}
      ref={ref}
      {...props}
    />
  ),
);
ButtonGroup.displayName = "ButtonGroup";

export const ButtonGroupText = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    className={cn(
      "flex items-center justify-center px-3 text-sm font-medium text-foreground",
      className,
    )}
    ref={ref}
    {...props}
  />
));
ButtonGroupText.displayName = "ButtonGroupText";
