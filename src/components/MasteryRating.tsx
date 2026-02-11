"use client";

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MasteryRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const MasteryRating: React.FC<MasteryRatingProps> = ({ 
  value = 0, 
  onChange, 
  readonly = false,
  size = 'md' 
}) => {
  const [hover, setHover] = useState<number | null>(null);

  const sizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            if (!readonly && onChange) onChange(star);
          }}
          className={cn(
            "transition-all duration-200",
            readonly ? "cursor-default" : "cursor-pointer hover:scale-125 active:scale-90",
            (hover !== null ? star <= hover : star <= value) 
              ? "text-amber-400 fill-amber-400" 
              : "text-muted-foreground/30 fill-transparent"
          )}
        >
          <Star className={cn(sizes[size])} />
        </button>
      ))}
    </div>
  );
};

export default MasteryRating;