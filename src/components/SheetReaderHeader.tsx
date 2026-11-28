"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { ArrowLeft, Search, ChevronDown, Minus, Plus, FileText, Headphones, Link as LinkIcon, Ruler, Edit3, Trash2, MoreVertical, Settings2, Link2, Shuffle, Frown, Meh, Smile, SlidersHorizontal, Play, Pause, ListMusic } from 'lucide-react';
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
  onOpenReadinessWizard?: () => void;
  /** Readiness score (0-100) shown as a pill; also opens the wizard on tap. */
  readiness?: number;
  readerMode?: 'practice' | 'preferred' | 'live';
  onReaderModeChange?: (mode: 'practice' | 'preferred' | 'live') => void;
  /** Mutually-exclusive override of which resource the reader shows.
   *  'default' follows the song's preferred reader. */
  readerResource?: 'default' | 'force-pdf' | 'force-chords';
  onReaderResourceChange?: (resource: 'default' | 'force-pdf' | 'force-chords') => void;
  onShuffle?: () => void;
  onComfortRate?: (level: 'sad' | 'mid' | 'happy') => void;
  isPlaying?: boolean;
  onTogglePlayback?: () => void;
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
  onOpenReadinessWizard,
  readiness,
  readerMode = 'preferred',
  onReaderModeChange,
  readerResource = 'default',
  onReaderResourceChange,
  onShuffle,
  onComfortRate,
  isPlaying,
  onTogglePlayback,
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
          title="Search Songs"
          aria-label="Toggle song list with search"
        >
          <Search className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
        
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
            title="Back to Dashboard"
            aria-label="Back to dashboard"
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
            <h2
              className="text-xs md:text-lg font-black uppercase tracking-tight text-white truncate max-w-[150px] md:max-w-md text-center leading-none cursor-pointer hover:text-indigo-400 transition-colors"
              onClick={onOpenReadinessWizard}
            >
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
        {onReaderModeChange && (
          <div className="hidden sm:flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-xl p-0.5">
            {(['practice', 'preferred', 'live'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onReaderModeChange(m)}
                aria-pressed={readerMode === m}
                className={cn(
                  "min-h-8 rounded-lg px-2 text-[9px] font-black uppercase tracking-widest transition-all",
                  readerMode === m ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                )}
                title={m === 'practice' ? 'Practice: all songs' : m === 'preferred' ? 'Preferred reader songs' : 'Live-ready songs'}
              >
                {m === 'practice' ? 'All' : m === 'preferred' ? 'Pref' : 'Live'}
              </button>
            ))}
          </div>
        )}
        {onReaderResourceChange && (
          <div className="hidden lg:flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Reader source override">
            <span className={cn("px-1.5 text-[8px] font-black uppercase tracking-widest", readerResource === 'default' ? "text-slate-500" : "text-indigo-400")}>Source</span>
            {([
              { value: 'default', label: 'Preferred', icon: SlidersHorizontal },
              { value: 'force-pdf', label: 'PDFs', icon: FileText },
              { value: 'force-chords', label: 'Chords', icon: ListMusic },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onReaderResourceChange(value)}
                aria-pressed={readerResource === value}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[9px] font-black uppercase tracking-widest transition-all",
                  readerResource === value ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                )}
                title={`Reader source: ${label}${value === 'default' ? ' (follows each song)' : ' (overrides each song)'}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        )}
        {onTogglePlayback && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePlayback}
            className={cn(
              "h-8 w-8 md:h-10 md:w-10 rounded-xl transition-all",
              isPlaying ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
            title={isPlaying ? 'Pause audio [Space]' : 'Play audio [Space]'}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5" /> : <Play className="w-4 h-4 md:w-5 md:h-5" />}
          </Button>
        )}
        {onShuffle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShuffle}
            className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
            title="Shuffle reader"
            aria-label="Shuffle reader songs"
          >
            <Shuffle className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        )}
        {onComfortRate && currentSong && (
          <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-xl p-1">
            <button type="button" onClick={() => onComfortRate('sad')} title="Not ready to sing" className="h-11 w-11 md:h-8 md:w-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all" aria-label="Mark not ready">
              <Frown className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button type="button" onClick={() => onComfortRate('mid')} title="Unsure" className="h-11 w-11 md:h-8 md:w-8 rounded-lg flex items-center justify-center text-amber-400 hover:bg-amber-500/20 transition-all" aria-label="Mark unsure">
              <Meh className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button type="button" onClick={() => onComfortRate('happy')} title="Can sing this" className="h-11 w-11 md:h-8 md:w-8 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-all" aria-label="Mark ready to sing">
              <Smile className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        )}
        {currentSong && typeof readiness === 'number' && (
          <button
            onClick={onOpenReadinessWizard}
            title="Readiness score — tap to review what's still missing"
            aria-label={`Readiness ${readiness} percent. Open readiness wizard.`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 md:px-2.5 md:py-1 text-[9px] md:text-[11px] font-black tabular-nums transition-all hover:brightness-125 active:scale-95",
              readiness >= 75
                ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                : readiness >= 50
                ? "bg-amber-600/20 text-amber-400 border-amber-500/30"
                : readiness >= 25
                ? "bg-orange-600/20 text-orange-400 border-orange-500/30"
                : "bg-red-600/20 text-red-400 border-red-500/30"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                readiness >= 75
                  ? "bg-emerald-400"
                  : readiness >= 50
                  ? "bg-amber-400"
                  : readiness >= 25
                  ? "bg-orange-400"
                  : "bg-red-400"
              )}
            />
            {readiness}%
          </button>
        )}
        {currentSong && (
          <span className={cn(
            "inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full text-[9px] md:text-[11px] font-black border",
            (currentSong.comfort_level || 0) > 0
              ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
              : (currentSong.comfort_level || 0) < 0
              ? "bg-red-600/20 text-red-400 border-red-500/30"
              : "bg-slate-800/50 text-slate-500 border-slate-700/50 hidden md:inline-flex"
          )}>
            {(currentSong.comfort_level || 0) > 0 ? `+${currentSong.comfort_level}` : currentSong.comfort_level || 0}
          </span>
        )}
        {currentSong && !isMobile && (
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPitch(pitch - 1)}
              className="h-8 w-8 rounded-lg hover:bg-white/10 text-slate-400"
              aria-label="Decrease pitch by 1 semitone"
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
              aria-label="Increase pitch by 1 semitone"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/5 text-slate-400" aria-label="Open song tools menu">
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
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Reader Mode</DropdownMenuLabel>
              {(['practice', 'preferred', 'live'] as const).map((m) => (
                <DropdownMenuItem key={m} onClick={() => onReaderModeChange?.(m)} className={cn("h-11 rounded-lg gap-3 text-xs font-bold uppercase", readerMode === m && "bg-indigo-600/20 text-indigo-400")}>
                  <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> {m === 'practice' ? 'Practice (All)' : m === 'preferred' ? 'Preferred Reader' : 'Live Ready'}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Reader Source</DropdownMenuLabel>
              {([
                { value: 'default', label: 'Preferred (default)', icon: SlidersHorizontal },
                { value: 'force-pdf', label: 'Force PDFs', icon: FileText },
                { value: 'force-chords', label: 'Force Chords', icon: ListMusic },
              ] as const).map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem key={value} onClick={() => onReaderResourceChange?.(value)} className={cn("h-11 rounded-lg gap-3 text-xs font-bold uppercase", readerResource === value && "bg-indigo-600/20 text-indigo-400")}>
                  <Icon className="w-4 h-4 text-indigo-400" /> {label}
                </DropdownMenuItem>
              ))}
              {onShuffle && (
                <DropdownMenuItem onClick={onShuffle} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                  <Shuffle className="w-4 h-4 text-emerald-400" /> Shuffle Reader
                </DropdownMenuItem>
              )}
              {onTogglePlayback && (
                <DropdownMenuItem onClick={onTogglePlayback} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                  {isPlaying ? <Pause className="w-4 h-4 text-red-400" /> : <Play className="w-4 h-4 text-emerald-400" />} {isPlaying ? 'Pause Audio' : 'Play Audio'}
                </DropdownMenuItem>
              )}
              {onComfortRate && currentSong && (
                <>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Rate This Song</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onComfortRate('sad')} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase text-red-400">
                    <Frown className="w-4 h-4" /> Not ready
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onComfortRate('mid')} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase text-amber-400">
                    <Meh className="w-4 h-4" /> Unsure
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onComfortRate('happy')} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase text-emerald-400">
                    <Smile className="w-4 h-4" /> Can sing
                  </DropdownMenuItem>
                </>
              )}
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
                  <DropdownMenuItem onClick={onOpenLinkSizeModal} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                    <Ruler className="w-4 h-4 text-indigo-400" /> Link Size
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
              aria-label="Open song studio"
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
              aria-label={isAudioPlayerVisible ? "Hide audio player" : "Show audio player"}
            >
              <Headphones className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenRepertoireSearch}
              className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
              aria-label="Search library"
            >
              <Search className="w-5 h-5" />
            </Button>
            {hasPdf && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
                    aria-label="Link management"
                  >
                    <Link2 className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent align="end" className="bg-slate-950 border-white/10 text-white p-2 rounded-xl z-[300]">
                    <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Link Management</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={onAddLink} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                      <Plus className="w-4 h-4 text-indigo-400" /> Add New Link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onToggleLinkEditMode} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                      {isEditingLinksMode ? <Trash2 className="w-4 h-4 text-red-400" /> : <Edit3 className="w-4 h-4 text-indigo-400" />}
                      {isEditingLinksMode ? "Exit Edit Mode" : "Edit Links"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenLinkSizeModal} className="h-11 rounded-lg gap-3 text-xs font-bold uppercase">
                      <Ruler className="w-4 h-4 text-indigo-400" /> Link Size
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SheetReaderHeader;