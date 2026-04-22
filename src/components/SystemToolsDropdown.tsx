"use client";

import React from 'react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  Wrench, ShieldCheck, Sparkles, Shuffle, Hash, Settings2, 
  ChevronDown, Zap, Database, BookOpen 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface SystemToolsDropdownProps {
  onOpenMDAudit: () => void;
  onToggleShuffleAll: () => void;
  isShuffleAllMode: boolean;
  onOpenKeyMatrix: () => void;
  onOpenPreferences: () => void;
  onOpenUserGuide: () => void;
}

const SystemToolsDropdown: React.FC<SystemToolsDropdownProps> = ({
  onOpenMDAudit,
  onToggleShuffleAll,
  isShuffleAllMode,
  onOpenKeyMatrix,
  onOpenPreferences,
  onOpenUserGuide
}) => {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="h-12 px-6 rounded-2xl text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[11px] gap-3"
        >
          <Wrench className="w-5 h-5" />
          System Tools
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2 rounded-[1.5rem] bg-slate-950 border-white/10 shadow-2xl">
        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">
          Performance Modes
        </DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={() => navigate('/audit-reader')}
          className="h-11 rounded-xl text-xs font-bold uppercase gap-3 text-amber-500 focus:text-amber-400 focus:bg-amber-500/10"
        >
          <ShieldCheck className="w-4 h-4" /> Audit Mode
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-white/5" />
        
        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">
          AI & Automation
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onOpenMDAudit} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <Sparkles className="w-4 h-4 text-indigo-400" /> MD Audit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleShuffleAll} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <Shuffle className={cn("w-4 h-4", isShuffleAllMode ? "text-indigo-400 animate-spin-slow" : "text-slate-400")} />
          {isShuffleAllMode ? "Disable Shuffle All" : "Enable Shuffle All"}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/5" />

        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">
          Configuration
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onOpenKeyMatrix} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <Hash className="w-4 h-4 text-indigo-400" /> Key Matrix
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenPreferences} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <Settings2 className="w-4 h-4 text-indigo-400" /> Preferences
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenUserGuide} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <BookOpen className="w-4 h-4 text-blue-400" /> User Guide
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SystemToolsDropdown;