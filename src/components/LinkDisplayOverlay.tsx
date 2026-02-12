"use client";

import React from 'react';
import { Trash2, Edit3, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useSettings } from '@/hooks/use-settings';
import { SheetLink } from '@/types/sheet-music';

interface LinkDisplayOverlayProps {
  links: SheetLink[];
  currentPage: number;
  onNavigateToPage: (page: number) => void;
  onLinkDeleted: () => void;
  isEditingMode: boolean;
  onEditLink: (link: SheetLink) => void;
  pageContainerRef: React.RefObject<HTMLDivElement>;
  pdfScale: number | null;
  overlayWrapperRef: React.RefObject<HTMLDivElement>;
}

const LinkDisplayOverlay: React.FC<LinkDisplayOverlayProps> = ({
  links,
  currentPage,
  onNavigateToPage,
  onLinkDeleted,
  isEditingMode,
  onEditLink,
  pageContainerRef,
  pdfScale,
  overlayWrapperRef
}) => {
  const { linkSize: globalLinkSize } = useSettings();

  const currentLinks = links.filter(l => l.source_page === currentPage);

  const getSizePx = (size: string) => {
    const base = 40;
    const scale = pdfScale || 1;
    switch (size) {
      case 'small': return base * 0.7 * scale;
      case 'large': return base * 1.5 * scale;
      case 'extra-large': return base * 2.0 * scale;
      default: return base * scale;
    }
  };

  if (!pdfScale) return null;

  return (
    <div className="absolute inset-0 pointer-events-none w-full h-full">
      {currentLinks.map((link) => {
        const size = getSizePx(link.link_size || globalLinkSize);
        
        return (
          <div
            key={link.id}
            className="absolute pointer-events-auto group"
            style={{
              left: `${link.source_x}%`,
              top: `${link.source_y}%`,
              width: `${size}px`,
              height: `${size}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditingMode) {
                  onNavigateToPage(link.target_page);
                }
              }}
              className={cn(
                "w-full h-full rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                isEditingMode 
                  ? "bg-amber-500/40 border-2 border-amber-400 animate-pulse" 
                  : "bg-indigo-600/30 border-2 border-indigo-400/50 hover:bg-indigo-500/60 hover:scale-110 active:scale-90"
              )}
            >
              {isEditingMode ? (
                <Edit3 className="w-1/2 h-1/2 text-white" />
              ) : (
                <ExternalLink className="w-1/2 h-1/2 text-white drop-shadow-md" />
              )}
            </button>

            {isEditingMode && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 rounded-full shadow-xl"
                  onClick={async (e) => {
                    e.stopPropagation();
                    onLinkDeleted();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            {!isEditingMode && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black/80 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10">
                  Go to Page {link.target_page}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LinkDisplayOverlay;