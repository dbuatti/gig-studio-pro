"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Command, HardDrive, LayoutDashboard, Library, LogOut } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import SystemToolsDropdown from './SystemToolsDropdown';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  onOpenStorageAudit: () => void;
  onOpenAdmin: () => void;
  onOpenMDAudit: () => void;
  onToggleShuffleAll: () => void;
  isShuffleAllMode: boolean;
  onOpenKeyMatrix: () => void;
  onOpenPreferences: () => void;
  onOpenUserGuide: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onOpenStorageAudit,
  onOpenAdmin,
  onOpenMDAudit,
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
    <div className="space-y-8 md:space-y-12 mb-8 md:mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="bg-indigo-600 p-3 md:p-4 rounded-2xl md:rounded-[2rem] shadow-2xl shadow-indigo-600/30 group hover:scale-105 transition-transform cursor-pointer" onClick={() => navigate('/')}>
            <Command className="w-6 h-6 md:w-10 md:h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Gig Studio</h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] text-[9px] md:text-[11px] mt-2 md:mt-3">
              Professional Performance Matrix
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={onOpenStorageAudit}
            className="flex-1 md:flex-none h-10 md:h-12 px-4 md:px-6 rounded-xl md:rounded-2xl text-amber-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[9px] md:text-[11px] gap-2 md:gap-3"
          >
            <HardDrive className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Storage Audit</span><span className="sm:hidden">Storage</span>
          </Button>
          
          <SystemToolsDropdown
            onOpenAdmin={onOpenAdmin}
            onOpenMDAudit={onOpenMDAudit}
            onToggleShuffleAll={onToggleShuffleAll}
            isShuffleAllMode={isShuffleAllMode}
            onOpenKeyMatrix={onOpenKeyMatrix}
            onOpenPreferences={onOpenPreferences}
            onOpenUserGuide={onOpenUserGuide}
          />

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="h-10 md:h-12 w-10 md:w-12 p-0 rounded-xl md:rounded-2xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex justify-center md:justify-start">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-14 md:h-16 bg-slate-900/50 p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] border border-white/5">
          <TabsTrigger 
            value="gigs" 
            className="text-xs md:text-sm font-black uppercase tracking-widest gap-2 md:gap-3 h-11 md:h-12 rounded-xl md:rounded-2xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:shadow-indigo-600/30"
          >
            <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5" /> Gigs
          </TabsTrigger>
          <TabsTrigger 
            value="repertoire" 
            className="text-xs md:text-sm font-black uppercase tracking-widest gap-2 md:gap-3 h-11 md:h-12 rounded-xl md:rounded-2xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:shadow-indigo-600/30"
          >
            <Library className="w-4 h-4 md:w-5 md:h-5" /> Repertoire
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
};

export default DashboardHeader;