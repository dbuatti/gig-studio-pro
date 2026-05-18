"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Command, HardDrive, LayoutDashboard, Library } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import SystemToolsDropdown from './SystemToolsDropdown';

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
  return (
    <div className="space-y-12 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-8">
          <div className="bg-indigo-600 p-4 rounded-[2rem] shadow-2xl shadow-indigo-600/30">
            <Command className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter leading-none">Gig Studio</h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[11px] mt-3">
              Professional Performance Matrix
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            variant="outline" 
            onClick={onOpenStorageAudit} 
            className="h-12 px-6 rounded-2xl text-amber-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[11px] gap-3"
          >
            <HardDrive className="w-5 h-5" /> Storage Audit
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
        </div>
      </div>

      <div className="flex justify-center md:justify-start">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-16 bg-slate-900/50 p-2 rounded-[2rem] border border-white/5">
          <TabsTrigger 
            value="gigs" 
            className="text-sm font-black uppercase tracking-widest gap-3 h-12 rounded-2xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:shadow-indigo-600/30"
          >
            <LayoutDashboard className="w-5 h-5" /> Gigs
          </TabsTrigger>
          <TabsTrigger 
            value="repertoire" 
            className="text-sm font-black uppercase tracking-widest gap-3 h-12 rounded-2xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:shadow-indigo-600/30"
          >
            <Library className="w-5 h-5" /> Repertoire
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
};

export default DashboardHeader;