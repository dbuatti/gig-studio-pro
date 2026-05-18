"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Button } from "@/components/ui/button";
import { 
  Check, ShieldCheck, CloudDownload, AlertTriangle, 
  Edit3, Trash2, Plus, ArrowRight, MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import { calculateReadiness } from '@/utils/repertoireSync';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import SetlistMultiSelector from './SetlistMultiSelector';

interface RepertoireMobileCardProps {
  song: SetlistSong;
  onEdit: (song: SetlistSong) => void;
  onDelete: (id: string) => void;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  currentPref: 'sharps' | 'flats' | 'neutral';
}

const RepertoireMobileCard: React.FC<RepertoireMobileCardProps> = ({
  song, onEdit, onDelete, allSetlists, onUpdateSetlistSongs, currentPref
}) => {
  const readinessScore = calculateReadiness(song);
  const isFullyReady = readinessScore === 100;
  const displayOrigKey = formatKey(song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
  const isExtractionFailed = song.extraction_status === 'failed';

  return (
    <div
      onClick={() => onEdit(song)}
      className="bg-card rounded-2xl border-2 border-border p-4 flex flex-col gap-4 shadow-lg active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-black tracking-tight flex items-center gap-2 truncate">
            {song.name}
            {isFullyReady && <Check className="w-4 h-4 text-emerald-500" />}
            {isProcessing && <CloudDownload className="w-4 h-4 text-indigo-500 animate-bounce" />}
            {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-500" />}
          </h4>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1 truncate">
            {song.artist || "Unknown Artist"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Ready</span>
            <span className={cn(
              "text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg",
              readinessScore >= 90 ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-500"
            )}>
              {readinessScore}%
            </span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }} className="h-10 rounded-lg text-xs font-bold uppercase">
                <Edit3 className="w-4 h-4 mr-2" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive h-10 rounded-lg text-xs font-bold uppercase" onClick={(e) => { e.stopPropagation(); onDelete(song.id); }}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Key Map</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-muted-foreground">{displayOrigKey}</span>
              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground opacity-30" />
              <div className={cn(
                "font-mono font-black text-[10px] px-2 py-0.5 rounded-lg text-white flex items-center gap-1",
                song.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600"
              )}>
                {displayTargetKey}
                {song.isKeyConfirmed && <Check className="w-2.5 h-2.5" />}
              </div>
            </div>
          </div>
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <SetlistMultiSelector
            songMasterId={song.id}
            allSetlists={allSetlists}
            songToAssign={song}
            onUpdateSetlistSongs={onUpdateSetlistSongs}
          />
        </div>
      </div>
    </div>
  );
};

export default RepertoireMobileCard;