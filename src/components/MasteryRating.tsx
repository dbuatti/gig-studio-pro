"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface MasteryRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: "text-[10px] w-11 h-11 md:w-5 md:h-5",
  md: "text-sm w-11 h-11 md:w-7 md:h-7",
  lg: "text-lg w-12 h-12 md:w-10 md:h-10"
};

const btnSizes = {
  sm: "w-11 h-11 md:w-4 md:h-4 text-[9px]",
  md: "w-11 h-11 md:w-6 md:h-6 text-xs",
  lg: "w-12 h-12 md:w-8 md:h-8 text-sm"
};

const MasteryRating: React.FC<MasteryRatingProps> = ({
  value = 0,
  onChange,
  readonly = false,
  size = 'md'
}) => {
  const colorClass = value > 0
    ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
    : value < 0
    ? "bg-red-600/20 text-red-400 border-red-500/30"
    : "bg-slate-800/50 text-slate-500 border-slate-700/50";

  const btnColor = value > 0
    ? "text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30"
    : value < 0
    ? "text-red-400 hover:bg-red-500/20 border-red-500/30"
    : "text-slate-500 hover:bg-slate-700/50 border-slate-700/50";

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {readonly ? (
        <span className={cn(
          "inline-flex items-center justify-center font-black rounded-md border",
          sizes[size], colorClass
        )}>
          {value > 0 ? `+${value}` : value}
        </span>
      ) : (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Decrease mastery"
            disabled={value <= -5}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange?.(Math.max(-5, value - 1)); }}
            className={cn(
              "flex items-center justify-center rounded-full border transition-all hover:scale-110 active:scale-90 font-black",
              btnSizes[size], btnColor
            )}
          >
            −
          </button>
          <span className={cn(
            "inline-flex items-center justify-center font-black rounded-md border select-none",
            sizes[size], colorClass
          )}>
            {value > 0 ? `+${value}` : value}
          </span>
          <button
            type="button"
            aria-label="Increase mastery"
            disabled={value >= 5}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange?.(Math.min(5, value + 1)); }}
            className={cn(
              "flex items-center justify-center rounded-full border transition-all hover:scale-110 active:scale-90 font-black",
              btnSizes[size], btnColor
            )}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
};

export default MasteryRating;
