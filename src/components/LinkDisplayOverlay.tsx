"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Trash2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import { useSettings } from '@/hooks/use-settings';

export interface SheetLink {
  id: string;
  user_id: string;
  song_id: string;
  source_page: number;
  source_x: number; // Normalized 0-1
  source_y: number; // Normalized 0-1
  target_page: number;
  target_x: number; // Normalized 0-1
  target_y: number; // Normalized 0-1
  link_size: 'small' | 'medium' | 'large' | 'extra-large';
  created_at: string;
}

interface LinkDisplayOverlayProps {
  links: SheetLink[];
  currentPage: number;
  onNavigateToPage: (pageNumber: number, x?: number, y?: number) => void;
  onLinkDeleted: () => void;
  isEditingMode: boolean; // NEW: Prop to indicate if in annotation/edit mode
  onEditLink: (link: SheetLink) => void; // NEW: Callback for editing a link
}

const LinkDisplayOverlay: React.FC<LinkDisplayOverlayProps> = ({
  links,
  currentPage,
  onNavigateToPage,
  onLinkDeleted,
  isEditingMode,
  onEditLink,
}) => {
  const { user } = useAuth();
  const { linkSize: globalLinkSize } = useSettings(); // Get global link size

  const [flashingTargetId, setFlashingTargetId] = useState<string | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLinkClick = useCallback((link: SheetLink) => {
    if (isEditingMode) {
      onEditLink(link); // If in edit mode, trigger edit callback
      return;
    }
    onNavigateToPage(link.target_page, link.target_x, link.target_y);
    setFlashingTargetId(link.id);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashingTargetId(null);
    }, 1500); // Flash for 1.5 seconds
  }, [isEditingMode, onEditLink, onNavigateToPage]);

  const handleDeleteLink = useCallback(async (linkId: string) => {
    if (!user) {
      showError("Authentication required to delete links.");
      return;
    }
    if (!confirm("Are you sure you want to delete this link?")) return;

    try {
      const { error } = await supabase.from('sheet_links').delete().eq('id', linkId).eq('user_id', user.id);
      if (error) throw error;
      showSuccess("Link deleted successfully.");
      onLinkDeleted();
    } catch (err: any) {
      showError(`Failed to delete link: ${err.message}`);
    }
  }, [user, onLinkDeleted]);

  const getLinkDotSize = useCallback((size: SheetLink['link_size']) => {
    switch (size) {
      case 'small': return 16;
      case 'medium': return 24;
      case 'large': return 32;
      case 'extra-large': return 40;
      default: return 24; // Default to medium
    }
  }, []);

  return (
    <TooltipProvider>
      {links.map(link => {
        const isSource = link.source_page === currentPage;
        const isTarget = link.target_page === currentPage;
        const isFlashing = flashingTargetId === link.id;

        const dotSize = getLinkDotSize(link.link_size || globalLinkSize);

        // Render source dots (blue)
        if (isSource) {
          return (
            <Tooltip key={link.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleLinkClick(link)}
                  className={cn(
                    "absolute rounded-full bg-indigo-600 border-2 border-indigo-700 shadow-lg flex items-center justify-center text-white font-bold transition-all duration-200 ease-out",
                    isEditingMode ? "opacity-100 cursor-grab" : "opacity-80 hover:opacity-100 active:scale-95",
                  )}
                  style={{
                    left: `${link.source_x * 100}%`,
                    top: `${link.source_y * 100}%`,
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                  }}
                  title={`Go to Page ${link.target_page}`}
                >
                  <ArrowRight className="w-3 h-3" />
                  {isEditingMode && (
                    <div className="absolute -top-8 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 bg-white/20 hover:bg-white/30 text-white rounded-full"
                        onClick={(e) => { e.stopPropagation(); onEditLink(link); }}
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-full"
                        onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">
                Link to Page {link.target_page}
              </TooltipContent>
            </Tooltip>
          );
        }

        // Render flashing target dots (orange)
        if (isTarget && isFlashing) {
          return (
            <div
              key={`target-${link.id}`}
              className="absolute rounded-full bg-orange-600 border-2 border-orange-700 shadow-lg animate-pulse-once"
              style={{
                left: `${link.target_x * 100}%`,
                top: `${link.target_y * 100}%`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 15,
              }}
            />
          );
        }
        return null;
      })}
    </TooltipProvider>
  );
};

export default LinkDisplayOverlay;