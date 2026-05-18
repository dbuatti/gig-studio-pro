"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { ArrowLeft, Search, ListMusic, ChevronDown, Minus, Plus, FileText, Headphones, Link as LinkIcon, Ruler, Edit3, Trash2, MoreVertical, Settings2 } from 'lucide-react';
import { SetlistSong } from '@/components/SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';

interface SheetReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void;
  onOpenRepertoireSearch: () => void;
  onOpenCurrentSongStudio: () => void;
  isLoading: boolean;
  keyPreference: KeyPreference;
  onUpdateKey: (newTargetKey: string) => void;
  setIsOverlayOpen: (isOpen: boolean) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  readerKeyPreference: 'sharps' | 'flats';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  effectiveTargetKey: string;
  isAudioPlayerVisible: boolean;
  onToggleAudioPlayer: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onAddLink: () => void;
  onToggleLinkEditMode: () => void;
  onOpenLinkSizeModal: () => void;
  isEditingLinksMode: boolean;
  setGroup?: number;
  totalSets?: number;
}

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose,
  onOpenRepertoireSearch,
  onOpenCurrentSongStudio,
  isLoading,
  keyPreference,
  onUpdateKey,
  setIsOverlayOpen,
  pitch,
  setPitch,
  readerKeyPreference,
  isSidebarOpen,
  onToggleSidebar,
  effectiveTargetKey,
  isAudioPlayerVisible,
  onToggleAudioPlayer,
  isFullScreen,
  onToggleFullScreen,
  onAddLink,
  onToggleLinkEditMode,
  onOpenLinkSizeModal,
  isEditingLinksMode,
  setGroup,
  totalSets,
}) => {
  const isMobile = useIsMobile();
  const displayKey = effectiveTargetKey ? formatKey(effectiveTargetKey, readerKeyPreference) : null;
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const activeKeyItemRef = useRef<HTMLDivElement>(null);

  const handleDropdownOpenChange = (open: boolean) => {
    setIsOverlayOpen(open);
    if (open && activeKeyItemRef.current) {
      setTimeout(() => {
        activeKeyItemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    }
  };

  const hasPdf = !!currentSong?.pdfUrl || !!currentSong?.leadsheetUrl || !!currentSong?.sheet_music_url;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 px-4 md:px-6 py-2 md:py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300 h-14 md:h-[72px]",
        isFullScreen && "hidden"
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className={cn(
            "h-9 w-9 md:h-10 md:w-10 rounded-xl transition-all",
            isSidebarOpen ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white/5 hover:bg-white/10 text-slate-400"
          )}
          title="Toggle Song List"
        >
          <ListMusic className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
        
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center min-w-0 px-2">
        {isLoading ? (
          <Skeleton className="h-6 w-32 md:w-64 bg-white/10 rounded-lg" />
        ) : currentSong ? (
          <div className="flex flex-col items-center min-w-0">
            <h2 className="text-xs md:text-lg font-black uppercase tracking-tight text-white truncate max-w-[150px] md:max-w-md text-center leading-none">
              {currentSong.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {setGroup && (
                <Badge variant="outline" className="bg-indigo-600/20 border-indigo-500/30 text-indigo-400 text-[7px] md:text-[9px] font-black uppercase px-1.5 py-0 rounded-md shrink-0">
                  Set {setGroup}
                </Badge>
              )}
              <span className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate hidden xs:inline">
                {currentSong.artist}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase">No Selection</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-3">
        {currentSong && !isMobile && (
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPitch(pitch - 1)}
              className="h-8 w-8 rounded-lg hover:bg-white/10 text-slate-400"
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>

            <DropdownMenu onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="bg-transparent text-[10px] md:text-xs font-black font-mono h-8 px-2 rounded-lg text-indigo-400 gap-1 hover:bg-transparent min-w-[60px]"
                >
                  {displayKey || '--'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar">
                  {keysToUse.map((k) => (
                    <DropdownMenuItem
                      key={k}
                      onSelect={() => onUpdateKey(k)}
                      className={cn(
                        "font-mono font-bold cursor-pointer",
                        k === displayKey && "bg-indigo-600 text-white"
                      )}
                      ref={k === displayKey ? activeKeyItemRef : null}
                    >
                      {k}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPitch(pitch + 1)}
              className="h-8 w-8 rounded-lg hover:bg-white/10 text-slate-400"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/5 text-slate-400">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-white/10 text-white p-2 rounded-xl">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Song Tools</DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpenCurrentSongStudio} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                <Settings2 className="w-4 h-4 text-indigo-400" /> Open Studio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenRepertoireSearch} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                <Search className="w-4 h-4 text-indigo-400" /> Search Library
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">View Options</DropdownMenuLabel>
              <DropdownMenuItem onClick={onToggleAudioPlayer} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                <Headphones className="w-4 h-4 text-emerald-400" /> {isAudioPlayerVisible ? 'Hide' : 'Show'} Player
              </DropdownMenuItem>
              
              {hasPdf && (
                <>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Link Management</DropdownMenuLabel>
                  <DropdownMenuItem onClick={onAddLink} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                    <Plus className="w-4 h-4 text-indigo-400" /> Add New Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleLinkEditMode} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                    {isEditingLinksMode ? <Trash2 className="w-4 h-4 text-red-400" /> : <Edit3 className="w-4 h-4 text-indigo-400" />}
                    {isEditingLinksMode ? "Exit Edit Mode" : "Edit Links"}
                  </DropdownMenuItem>
                </>
              )}
              
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={onClose} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase text-red-400">
                <ArrowLeft className="w-4 h-4" /> Exit Reader
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenCurrentSongStudio}
              className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
            >
              <Settings2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleAudioPlayer}
              className={cn(
                "h-10 w-10 rounded-xl transition-all",
                isAudioPlayerVisible ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400"
              )}
            >
              <Headphones className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenRepertoireSearch}
              className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
            >
              <Search className="w-5 h-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SheetReaderHeader;