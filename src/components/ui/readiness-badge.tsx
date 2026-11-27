import * as React from "react";

import { cn } from "@/lib/utils";
import { getReadinessPresentation } from "@/utils/readinessUi";
import { StatusBadge } from "@/components/ui/status-badge";

export interface ReadinessBadgeProps {
  score: number;
  compact?: boolean;
  onInspect?: () => void;
  className?: string;
}

function ReadinessBadge({
  score,
  compact = false,
  onInspect,
  className,
}: ReadinessBadgeProps) {
  const readiness = getReadinessPresentation(score);
  const content = (
    <>
      <span className="font-semibold tabular-nums">{readiness.score}%</span>
      {compact ? (
        <span className="sr-only">{readiness.label}</span>
      ) : (
        <span>{readiness.label}</span>
      )}
    </>
  );

  if (!onInspect) {
    return (
      <StatusBadge tone={readiness.tone} className={className}>
        {content}
      </StatusBadge>
    );
  }

  return (
    <button
      type="button"
      onClick={onInspect}
      aria-label={`Inspect readiness: ${readiness.score}% (${readiness.label})`}
      className={cn(
        "inline-flex min-h-11 rounded-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2 focus-visible:ring-offset-studio-background disabled:pointer-events-none disabled:opacity-50 md:min-h-0",
        className,
      )}
    >
      <StatusBadge tone={readiness.tone}>{content}</StatusBadge>
    </button>
  );
}

export { ReadinessBadge };
