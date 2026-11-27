import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";
import type { ReadinessTone } from "@/utils/readinessUi";

export type StatusTone = ReadinessTone | "neutral";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        success:
          "border-studio-success/20 bg-studio-success/10 text-studio-success",
        info: "border-studio-info/20 bg-studio-info/10 text-studio-info",
        warning:
          "border-studio-warning/20 bg-studio-warning/10 text-studio-warning",
        danger: "border-studio-danger/20 bg-studio-danger/10 text-studio-danger",
        neutral:
          "border-studio-border bg-studio-raised text-studio-muted",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
}

function StatusBadge({ className, tone, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ tone }), className)}
      {...props}
    >
      {children}
    </span>
  );
}

export { StatusBadge };
