"use client";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Music, FileText, Guitar, Sparkles, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';

interface SheetMusicRecommenderProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onOpenInApp?: (app: string, url?: string) => void;
}

type ReaderType = 'ug' | 'ls' | 'fn' | null;

const SheetMusicRecommender: React.FC<SheetMusicRecommenderProps> = ({ 
  song, 
  formData, 
  handleAutoSave, 
  onOpenInApp 
}) => {
  const [recommendedReader, setRecommendedReader] = useState<ReaderType>(null);
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Determine recommendation based on song metadata
  useEffect(() => {
    if (!formData) return;
    
    const determineReader = () => {
      // Check for explicit user preference
      if (formData.preferred_reader) {
        setIsManualOverride(true);
        return formData.preferred_reader as ReaderType;
      } else {
        setIsManualOverride(false);
      }

      // Analyze song metadata
      const tags = formData.user_tags || [];
      const genre = formData.genre?.toLowerCase() || '';

      // Ultimate Guitar Pro recommendation
      if (
        tags.some(tag => ['chords', 'tabs', 'guitar', 'strumming'].includes(tag.toLowerCase())) ||
        ['rock', 'folk', 'pop', 'country'].includes(genre)
      ) {
        return 'ug';
      }

      // Lead Sheet recommendation
      if (
        tags.some(tag => ['lead sheet', 'jazz', 'standards', 'melody'].includes(tag.toLowerCase())) ||
        ['jazz', 'blues', 'swing'].includes(genre)
      ) {
        return 'ls';
      }

      // Full Notation recommendation
      if (
        tags.some(tag => ['full score', 'classical', 'orchestral', 'symphony'].includes(tag.toLowerCase())) ||
        ['classical', 'orchestral', 'symphony'].includes(genre)
      ) {
        return 'fn';
      }

      // Default based on complexity
      const keyComplexity = formData.originalKey?.length > 2 ? 'complex' : 'simple';
      const bpm = parseInt(formData.bpm || '0');
      const isComplex = keyComplexity === 'complex' || bpm > 140;
      
      return isComplex ? 'fn' : 'ug';
    };

    setRecommendedReader(determineReader());
  }, [formData]);

  const handleReaderSelect = (reader: ReaderType) => {
    // Toggle logic: if already selected, deselect. Otherwise, select.
    const newReader = formData.preferred_reader === reader ? null : reader;
    handleAutoSave({ preferred_reader: newReader });
    setIsManualOverride(!!newReader); // Set override if a reader is explicitly selected
  };

  const getReaderInfo = (reader: ReaderType) => {
    switch (reader) {
      case 'ug':
        return {
          name: 'Ultimate Guitar Pro',
          icon: Guitar,
          color: 'bg-orange-500',
          badge: 'Chords/Tabs'
        };
      case 'fn':
        return {
          name: 'Full Notation',
          icon: FileText,
          color: 'bg-emerald-500',
          badge: 'Full Score'
        };
      case 'ls':
        return {
          name: 'Lead Sheet',
          icon: Music,
          color: 'bg-indigo-500',
          badge: 'Lead Sheet'
        };
      default:
        return {
          name: 'None',
          icon: FileText,
          color: 'bg-slate-500',
          badge: 'Not Set'
        };
    }
  };

  const currentReader = formData.preferred_reader || recommendedReader;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Sheet Music Reader
        </Label>
        {isManualOverride ? (
          <Badge 
            variant="secondary" 
            className="bg-indigo-500/20 text-indigo-500 text-[8px] font-black"
          >
            USER OVERRIDE
          </Badge>
        ) : recommendedReader && (
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span className="text-[8px] font-black text-indigo-500 uppercase">AI RECOMMENDED</span>
          </div>
        )}
      </div>
      
      <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {['ug', 'ls', 'fn'].map((readerKey: ReaderType) => {
            const info = getReaderInfo(readerKey);
            const IconComponent = info.icon;
            const isActive = formData.preferred_reader === readerKey;
            const isRecommended = !formData.preferred_reader && recommendedReader === readerKey;

            return (
              <Button 
                key={readerKey}
                variant="outline" 
                onClick={() => handleReaderSelect(readerKey)}
                className={cn(
                  "flex flex-col items-center justify-center h-24 rounded-xl border transition-all group",
                  isActive 
                    ? `${info.color}/20 border-${info.color.split('-')[1]}-500 text-white shadow-lg` 
                    : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20 hover:text-white"
                )}
              >
                <IconComponent className={cn("w-6 h-6 mb-2", isActive ? "text-white" : `text-${info.color.split('-')[1]}-400`)} />
                <span className="text-[9px] font-black uppercase tracking-widest">{info.badge}</span>
                {isRecommended && (
                  <Sparkles className="absolute top-2 right-2 w-3 h-3 text-indigo-400" />
                )}
              </Button>
            );
          })}
        </div>
      </div>
      
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Recommendation Engine
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
          {currentReader 
            ? `The engine suggests using ${getReaderInfo(currentReader).name} for ${formData.name || 'this song'} based on its genre (${formData.genre || 'unknown'}) and musical characteristics.`
            : "Select a sheet music reader based on your performance needs."
          }
        </p>
      </div>
    </div>
  );
};

export default SheetMusicRecommender;