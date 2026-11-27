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
  ChevronDown, Zap, Database, BookOpen, ShieldAlert, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SystemToolsDropdownProps {
  onOpenAdmin: () => void;
  onOpenMDAudit: () => void;
  onOpenStorageAudit: () => void;
  onToggleShuffleAll: () => void;
  isShuffleAllMode: boolean;
  onOpenKeyMatrix: () => void;
  onOpenPreferences: () => void;
  onOpenUserGuide: () => void;
}

const SystemToolsDropdown: React.FC<SystemToolsDropdownProps> = ({
  onOpenAdmin,
  onOpenMDAudit,
  onOpenStorageAudit,
  onToggleShuffleAll,
  isShuffleAllMode,
  onOpenKeyMatrix,
  onOpenPreferences,
  onOpenUserGuide
}) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label="System tools"
          className="h-11 w-11 rounded-xl border-white/5 bg-white/5 p-0 text-indigo-400 transition-all hover:bg-white/10 md:h-12 md:w-auto md:rounded-2xl md:px-6 md:text-[11px] md:font-bold md:uppercase md:tracking-widest"
        >
          <Wrench className="h-4 w-4 md:h-5 md:w-5" />
          <span className="hidden md:inline">System Tools</span>
          <ChevronDown className="hidden h-4 w-4 opacity-50 md:block" />
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
        <DropdownMenuItem onClick={onOpenAdmin} className="h-11 rounded-xl text-xs font-bold uppercase gap-3 text-indigo-400">
          <ShieldAlert className="w-4 h-4" /> System Administration
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenStorageAudit} className="h-11 rounded-xl text-xs font-bold uppercase gap-3 text-amber-400 focus:text-amber-300 focus:bg-amber-500/10">
          <Database className="w-4 h-4" /> Storage Audit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenKeyMatrix} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <Hash className="w-4 h-4 text-indigo-400" /> Key Matrix
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenPreferences} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <Settings2 className="w-4 h-4 text-indigo-400" /> Preferences
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenUserGuide} className="h-11 rounded-xl text-xs font-bold uppercase gap-3">
          <BookOpen className="w-4 h-4 text-blue-400" /> User Guide
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/5" />
        
        <DropdownMenuItem onClick={handleLogout} className="h-11 rounded-xl text-xs font-bold uppercase gap-3 text-red-400 focus:text-red-300 focus:bg-red-400/10">
          <LogOut className="w-4 h-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

  );
};

export default SystemToolsDropdown;