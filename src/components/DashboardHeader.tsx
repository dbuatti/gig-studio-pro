"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Library, LogOut, Waves } from 'lucide-react';
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
    <header className="sticky top-0 z-40 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 border-b border-studio-border bg-studio-bg/95 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 py-3 md:py-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <button
            type="button"
            aria-label="Gig Studio Pro home"
            className="flex h-11 w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/30 transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-studio-bg"
            onClick={() => navigate('/')}
          >
            <Waves className="h-6 w-6 md:h-7 md:w-7" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-white md:text-3xl">
              Gig Studio <span className="text-indigo-400">Pro</span>
            </h1>
            <p className="mt-0.5 hidden text-[9px] font-bold uppercase tracking-[0.22em] text-studio-muted sm:flex sm:items-center sm:gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Performance workspace
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SystemToolsDropdown
            onOpenStorageAudit={onOpenStorageAudit}
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
            className="h-11 w-11 rounded-xl text-studio-muted hover:bg-red-500/10 hover:text-red-400"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="pb-3 md:pb-4">
        <TabsList className="grid h-11 w-full max-w-md grid-cols-2 gap-1 rounded-xl border border-studio-border bg-studio-surface p-1">
          <TabsTrigger
            value="gigs"
            className="gap-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-studio-muted transition-colors data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <LayoutDashboard className="h-4 w-4" /> Gigs
          </TabsTrigger>
          <TabsTrigger
            value="repertoire"
            className="gap-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-studio-muted transition-colors data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Library className="h-4 w-4" /> Repertoire
          </TabsTrigger>
        </TabsList>
      </div>
    </header>
  );
};

export default DashboardHeader;
