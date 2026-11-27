import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-studio-border bg-studio-surface px-4 py-10 text-center sm:px-6 sm:py-12",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-4 flex size-12 items-center justify-center rounded-xl border border-studio-border bg-studio-raised text-studio-muted [&_svg]:size-5"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold tracking-tight text-studio-foreground sm:text-xl">
        {title}
      </h2>
      {description ? (
        <div className="mt-2 max-w-md text-sm leading-6 text-studio-muted">
          {description}
        </div>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-6 flex w-full flex-col-reverse items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
          {secondaryAction}
          {primaryAction}
        </div>
      ) : null}
    </section>
  );
}

export { EmptyState };
