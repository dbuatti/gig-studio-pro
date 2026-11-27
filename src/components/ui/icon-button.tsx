import * as React from "react";

import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  "aria-label": string;
  children: React.ReactNode;
  compact?: boolean;
  variant?: "ghost" | "outline" | "soft";
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      compact = false,
      variant = "ghost",
      type = "button",
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2 focus-visible:ring-offset-studio-background disabled:pointer-events-none disabled:opacity-50 md:size-10 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
        compact && "md:size-8",
        variant === "ghost" &&
          "border-transparent text-studio-muted hover:bg-studio-raised hover:text-studio-foreground",
        variant === "outline" &&
          "border-studio-border bg-studio-surface text-studio-foreground hover:bg-studio-raised",
        variant === "soft" &&
          "border-transparent bg-studio-raised text-studio-foreground hover:bg-studio-border",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = "IconButton";

export { IconButton };
