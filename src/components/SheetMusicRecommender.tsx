"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Music, 
  FileText, 
  Guitar, 
  Sparkles, 
  Check,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';

interface SheetMusicRecommenderProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onOpenInApp?: (app: string, url?: string) => void;
}

type ReaderType = 'chords_ug' | 'full_forscore' | 'lead_forscore' | null;

const SheetMusicRecommender: React.FC<SheetMusicRecommenderProps> = ({
  song,
  formData,
  handleAutoSave,
  onOpenInApp
}) => {
  const [recommendedReader, setRecommendedReader] = useState<ReaderType>(null);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [userSelection, setUserSelection] = useState<ReaderType>(null);

  // Determine recommendation based on song metadata
  useEffect(() => {
    if (!formData) return;
    
    const determineReader = () => {
      // Check for explicit user preference
      if (formData.preferred_reader) {
        return formData.preferred_reader as ReaderType;
      }
      
      // Analyze song metadata
      const tags = formData.user_tags || [];
      const genre = formData.genre?.toLowerCase() || '';
      
      // Ultimate Guitar Pro recommendation
      if (
        tags.some(tag => 
          ['chords', 'tabs', 'guitar', 'strumming'].includes(tag.toLowerCase())
        ) ||
        ['rock', 'folk', 'pop', 'country'].includes(genre)
      ) {
        return 'chords_ug';
      }
      
      // Lead Sheet recommendation
      if (
        tags.some(tag => 
          ['lead sheet', 'jazz', 'standards', 'melody'].includes(tag.toLowerCase())
        ) ||
        ['jazz', 'blues', 'swing'].includes(genre)
      ) {
        return 'lead_forscore';
      }
      
      // Full Notation recommendation
      if (
        tags.some(tag => 
          ['full score', 'classical', 'orchestral', 'symphony'].includes(tag.toLowerCase())
        ) ||
        ['classical', 'orchestral', 'symphony'].includes(genre)
      ) {
        return 'full_forscore';
      }
      
      // Default based on complexity
      const keyComplexity = formData.originalKey?.length > 2 ? 'complex' : 'simple';
      const bpm = parseInt(formData.bpm || '0');
      const isComplex = keyComplexity === 'complex' || bpm > 140;
      
      return isComplex ? 'full_forscore' : 'chords_ug';
    };
    
    const recommendation = determineReader();
    setRecommendedReader(recommendation);
    setUserSelection(recommendation);
  }, [formData]);

  const handleReaderSelect = (reader: ReaderType) => {
    setUserSelection(reader);
    setIsManualOverride(true);
    
    // Save preference to song
    handleAutoSave({
      preferred_reader: reader
    });
  };

  const handleOpenInApp = () => {
    if (!userSelection) return;
    
    switch (userSelection) {
      case 'chords_ug':
        if (onOpenInApp) {
          onOpenInApp('Ultimate Guitar', formData.ugUrl);
        }
        break;
      case 'full_forscore':
      case 'lead_forscore':
        if (onOpenInApp) {
          onOpenInApp('ForScore', formData.pdfUrl || formData.leadsheetUrl);
        }
        break;
    }
  };

  const getReaderInfo = (reader: ReaderType) => {
    switch (reader) {
      case 'chords_ug':
        return {
          name: 'Ultimate Guitar Pro',
          icon: Guitar,
          description: 'For chord charts and tabs',
          color: 'bg-orange-500',
          badge: 'Chords/Tabs'
        };
      case 'full_forscore':
        return {
          name: 'Full Notation',
          icon: FileText,
          description: 'Detailed scores with multiple parts',
          color: 'bg-emerald-500',
          badge: 'Full Score'
        };
      case 'lead_forscore':
        return {
          name: 'Lead Sheet',
          icon: Music,
          description: 'Melody + chords for performance',
          color: 'bg-indigo-500',
          badge: 'Lead Sheet'
        };
      default:
        return {
          name: 'Select Reader',
          icon: FileText,
          description: 'Choose sheet music format',
          color: 'bg-slate-500',
          badge: 'Not Set'
        };
    }
  };

  const currentReader = userSelection || recommendedReader;
  const readerInfo = getReaderInfo(currentReader);
  const IconComponent = readerInfo.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Sheet Music Reader
        </Label>
        <Badge 
          variant="secondary" 
          className={cn(
            "text-[8px] font-black uppercase tracking-widest",
            currentReader === 'chords_ug' && "bg-orange-500/20 text-orange-500",
            currentReader === 'full_forscore' && "bg-emerald-500/20 text-emerald-500",
            currentReader === 'lead_forscore' && "bg-indigo-500/20 text-indigo-500"
          )}
        >
          {readerInfo.badge}
        </Badge>
      </div>
      
      <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", readerInfo.color)}>
              <IconComponent className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold">{readerInfo.name}</p>
              <p className="text-[10px] text-slate-500 uppercase font-black">
                {readerInfo.description}
              </p>
            </div>
          </div>
          
          {isManualOverride ? (
            <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-500 text-[8px] font-black">
              USER OVERRIDE
            </Badge>
          ) : recommendedReader && (
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span className="text-[8px] font-black text-indigo-500 uppercase">AI RECOMMENDED</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest bg-white/5 border-white/10 hover:bg-white/10"
              >
                <span>Change Reader</span>
                <ChevronDown className="w-3 h-3 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-slate-900 border-white/10 text-white">
              <DropdownMenuItem 
                onClick={() => handleReaderSelect('chords_ug')}
                className="flex items-center gap-2 py-2"
              >
                <Guitar className="w-4 h-4 text-orange-500" />
                <span>Ultimate Guitar</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleReaderSelect('full_forscore')}
                className="flex items-center gap-2 py-2"
              >
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>Full Notation</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleReaderSelect('lead_forscore')}
                className="flex items-center gap-2 py-2"
              >
                <Music className="w-4 h-4 text-indigo-500" />
                <span>Lead Sheet</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            onClick={handleOpenInApp}
            disabled={!currentReader}
            className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black uppercase tracking-widest gap-2"
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </Button>
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
            ? `Recommended for ${formData.name || 'this song'} based on genre (${formData.genre || 'unknown'}) and musical characteristics.`
            : "Select a sheet music reader based on your performance needs."}
        </p>
      </div>
    </div>
  );
};

export default SheetMusicRecommender;