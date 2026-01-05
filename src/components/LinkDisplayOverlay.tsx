"use client";

import React, { useState, useEffect, useCallback, useRef, CSSProperties } from 'react';
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
  isEditingMode: boolean;
  onEditLink: (link: SheetLink) => void;
  pageContainerRef: React.RefObject<HTMLDivElement>; // Ref to the rendered PDF page container (the div from react-pdf's Page)
  pdfScale: number; // PDF scale for accurate positioning
  overlayWrapperRef: React.RefObject<HTMLDivElement>; // Ref to the direct parent of LinkDisplayOverlay
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
  overlayWrapperRef, // NEW
}) => {
  const { user } = useAuth();
  const { linkSize: globalLinkSize } = useSettings();

  const [flashingTargetId, setFlashingTargetId] = useState<string | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLinkClick = useCallback((link: SheetLink) => {
    if (isEditingMode) {
      // In editing mode, clicking the dot itself doesn't navigate, but opens edit/delete options
      // The actual edit/delete actions are handled by the buttons that appear on hover.
      return;
    }
    onNavigateToPage(link.target_page, link.target_x, link.target_y);
    setFlashingTargetId(link.id);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashingTargetId(null);
    }, 1500);
    console.log("[LinkDisplayOverlay] Navigating via link: ", link.id);
  }, [isEditingMode, onNavigateToPage]);

  const handleDeleteLink = useCallback(async (linkId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click handler from firing
    if (!user) {
      showError("Authentication required to delete links.");
      return;
    }
    if (!confirm("Are you sure you want to delete this link?")) return;

    try {
      const { error } = await supabase.from('sheet_links').delete().eq('id', linkId).eq('user_id', user.id); // Corrected to user.id
      if (error) throw error;
      showSuccess("Link deleted successfully.");
      onLinkDeleted();
      console.log("[LinkDisplayOverlay] Link deleted: ", linkId);
    } catch (err: any) {
      console.error("[LinkDisplayOverlay] Failed to delete link: ", err.message);
      showError(`Failed to delete link: ${err.message}`);
    }
  }, [user, onLinkDeleted]);

  const handleEditLinkClick = useCallback((link: SheetLink, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click handler from firing
    onEditLink(link);
  }, [onEditLink]);

  const getLinkDotStyle = useCallback((link: SheetLink, type: 'source' | 'target', currentPage: number): CSSProperties => {
    if (!link || (type === 'source' && link.source_page !== currentPage) || (type === 'target' && link.target_page !== currentPage)) {
      return { display: 'none' };
    }

    const point = type === 'source' ? { x: link.source_x, y: link.source_y } : { x: link.target_x, y: link.target_y };
    const pdfPageContentElement = pageContainerRef.current;
    const overlayWrapperElement = overlayWrapperRef.current;

    if (!point || !pdfPageContentElement || !overlayWrapperElement) {
      return { display: 'none' };
    }

    const pageRect = pdfPageContentElement.getBoundingClientRect();
    const overlayWrapperRect = overlayWrapperElement.getBoundingClientRect();

    // Calculate the pixel position of the point relative to the viewport
    const absX = pageRect.left + point.x * pageRect.width;
    const absY = pageRect.top + point.y * pageRect.height;

    // Calculate the pixel position of the dot relative to the overlayWrapperElement
    const dotLeftPx = absX - overlayWrapperRect.left;
    const dotTopPx = absY - overlayWrapperRect.top;

    // Convert to percentage relative to the overlayWrapperElement's dimensions
    const dotLeftPct = (dotLeftPx / overlayWrapperRect.width) * 100;
    const dotTopPct = (dotTopPx / overlayWrapperRect.height) * 100;

    const baseSize = {
      'small': 16,
      'medium': 24,
      'large': 32,
      'extra-large': 40,
    }[link.link_size || globalLinkSize];

    return {
      position: 'absolute',
      left: `${dotLeftPct}%`,
      top: `${dotTopPct}%`,
      width: `${baseSize}px`,
      height: `${baseSize}px`,
      borderRadius: '50%',
      backgroundColor: type === 'source' ? 'rgba(79, 70, 229, 0.8)' : 'rgba(234, 88, 12, 0.8)', // indigo-600 / orange-600
      border: `2px solid ${type === 'source' ? 'rgba(79, 70, 229, 1)' : 'rgba(234, 88, 12, 1)'}`,
      transform: 'translate(-50%, -50%)',
      zIndex: 20, // Increased z-index for visibility
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '10px',
      fontWeight: 'bold',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      cursor: isEditingMode ? 'grab' : 'pointer', // Cursor changes in edit mode
    };
  }, [currentPage, pageContainerRef, overlayWrapperRef, globalLinkSize, isEditingMode]);

  return (
    <TooltipProvider>
      {links.map(link => {
        const isSource = link.source_page === currentPage;
        const isTarget = link.target_page === currentPage;
        const isFlashing = flashingTargetId === link.id;

        // Render source dots (blue)
        if (isSource) {
          return (
            <Tooltip key={link.id}>
              <TooltipTrigger asChild>
                <div // This is now a div, not a button
                  onClick={() => handleLinkClick(link)}
                  className={cn(
                    "absolute rounded-full bg-indigo-600 border-2 border-indigo-700 shadow-lg flex items-center justify-center text-white font-bold transition-all duration-200 ease-out group", // Added group class
                    isEditingMode ? "opacity-100 cursor-grab" : "opacity-80 hover:opacity-100 active:scale-95",
                  )}
                  style={getLinkDotStyle(link, 'source', currentPage)}
                  title={`Go to Page ${link.target_page}`}
                >
                  <ArrowRight className="w-3 h-3" />
                  {isEditingMode && (
                    <div className="absolute -top-8 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"> {/* Added pointer-events-auto */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 bg-white/20 hover:bg-white/30 text-white rounded-full"
                        onClick={(e) => handleEditLinkClick(link, e)} // Pass event to stop propagation
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-full"
                        onClick={(e) => handleDeleteLink(link.id, e)} // Pass event to stop propagation
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
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
              style={getLinkDotStyle(link, 'target', currentPage)}
            />
          );
        }
        return null;
      })}
    </TooltipProvider>
  );
};

export default LinkDisplayOverlay;