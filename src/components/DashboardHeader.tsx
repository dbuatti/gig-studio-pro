"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Command, HardDrive, LayoutDashboard, Library, LogOut, Waves } from 'lucide-react';
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
    <div className="space-y-10 md:space-y-16 mb-10 md:mb-20 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-12">
        <div className="flex items-center gap-5 md:gap-10">
          <div 
            className="bg-indigo-600 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] group hover:scale-105 transition-all cursor-pointer relative overflow-hidden" 
            onClick={() => navigate('/')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Waves className="w-8 h-8 md:w-12 md:h-12 text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-500">
              Gig Studio <span className="text-indigo-500">Pro</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] md:tracking-[0.5em] text-[10px] md:text-[12px] mt-3 md:mt-4 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Professional Performance Matrix
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 md:gap-5 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={onOpenStorageAudit}
            className="flex-1 md:flex-none h-11 md:h-14 px-5 md:px-8 rounded-2xl md:rounded-[1.5rem] text-amber-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[10px] md:text-[12px] gap-3 md:gap-4 shadow-xl"
          >
            <HardDrive className="w-4.5 h-4.5 md:w-5.5 md:h-5.5" /> <span className="hidden sm:inline">Storage Audit</span><span className="sm:hidden">Storage</span>
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
            className="h-11 md:h-14 w-11 md:w-14 p-0 rounded-2xl md:rounded-[1.5rem] text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
            title="Logout"
          >
            <LogOut className="w-5.5 h-5.5" />
          </Button>
        </div>
      </div>

      <div className="flex justify-center md:justify-start">
        <TabsList className="grid w-full max-w-lg grid-cols-2 h-16 md:h-20 bg-slate-900/50 p-2 md:p-2.5 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl">
          <TabsTrigger 
            value="gigs" 
            className="text-xs md:text-base font-black uppercase tracking-widest gap-3 md:gap-4 h-12 md:h-15 rounded-2xl md:rounded-[2rem] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-[0_0_30px_-5px_rgba(79,70,229,0.6)] transition-all"
          >
            <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6" /> Gigs
          </TabsTrigger>
          <TabsTrigger 
            value="repertoire" 
            className="text-xs md:text-base font-black uppercase tracking-widest gap-3 md:gap-4 h-12 md:h-15 rounded-2xl md:rounded-[2rem] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-[0_0_30px_-5px_rgba(79,70,229,0.6)] transition-all"
          >
            <Library className="w-5 h-5 md:w-6 md:h-6" /> Repertoire
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
};

export default DashboardHeader;