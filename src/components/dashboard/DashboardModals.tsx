"use client";

import React from "react";
import { SetlistSong, Setlist } from "@/components/SetlistManager";
import SongStudioModal from "@/components/SongStudioModal";
import PerformanceOverlay from "@/components/PerformanceOverlay";
import AdminPanel from "@/components/AdminPanel";
import PreferencesModal from "@/components/PreferencesModal";
import UserGuideModal from "@/components/UserGuideModal";
import KeyManagementModal from "@/components/KeyManagementModal";
import GlobalSearchModal from "@/components/GlobalSearchModal";
import SetlistSortModal from "@/components/SetlistSortModal";
import SetlistSettingsModal from "@/components/SetlistSettingsModal";
import MDAuditModal from "@/components/MDAuditModal";
import GigPlannerModal from "@/components/GigPlannerModal";
import ShortcutCheatSheet from "@/components/ShortcutCheatSheet";
import StorageAuditModal from "@/components/StorageAuditModal";
import ReadinessWizardModal from "@/components/ReadinessWizardModal";
import { StudioTab } from "@/components/SongStudioView";
import { syncToMasterRepertoire } from "@/utils/repertoireSync";
import { calculateSemitones } from "@/utils/keyUtils";
import { AudioEngineControls } from "@/hooks/use-tone-audio";
import { KeyPreference } from "@/hooks/use-settings";

interface DashboardModalsProps {
  userId: string | undefined;
  activeSetlist: Setlist | undefined;
  activeSong: SetlistSong | null;
  filteredAndSortedSongs: SetlistSong[];
  masterRepertoire: SetlistSong[];
  allSetlists: Setlist[];
  audio: AudioEngineControls;
  globalKeyPreference: KeyPreference;
  preventStageKeyOverwrite: boolean;

  // Modal states
  isSongStudioModalOpen: boolean;
  setIsSongStudioModalOpen: (v: boolean) => void;
  songStudioModalSongId: string | null;
  songStudioModalGigId: string | 'library' | null;
  songStudioDefaultTab: StudioTab | undefined;
  songStudioVisibleSongs: SetlistSong[] | null;
  isPerformanceOverlayOpen: boolean;
  setIsPerformanceOverlayOpen: (v: boolean) => void;
  isAdminPanelOpen: boolean;
  setIsAdminPanelOpen: (v: boolean) => void;
  isPreferencesOpen: boolean;
  setIsPreferencesOpen: (v: boolean) => void;
  isUserGuideOpen: boolean;
  setIsUserGuideOpen: (v: boolean) => void;
  isKeyManagementOpen: boolean;
  setIsKeyManagementOpen: (v: boolean) => void;
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (v: boolean) => void;
  isSetlistSortModalOpen: boolean;
  setIsSetlistSortModalOpen: (v: boolean) => void;
  isSetlistSettingsOpen: boolean;
  setIsSetlistSettingsOpen: (v: boolean) => void;
  isMDAuditOpen: boolean;
  setIsMDAuditOpen: (v: boolean) => void;
  isGigPlannerOpen: boolean;
  setIsGigPlannerOpen: (v: boolean) => void;
  isShortcutSheetOpen: boolean;
  setIsShortcutSheetOpen: (v: boolean) => void;
  isStorageAuditOpen: boolean;
  setIsStorageAuditOpen: (v: boolean) => void;
  activeSetGroup: number | null;
  setActiveSetGroup: (v: number | null) => void;
  auditData: Record<string, unknown> | null;
  isAuditLoading: boolean;

  // Standalone wizard (wizardMode on)
  isWizardStandaloneOpen: boolean;
  wizardStandaloneSong: SetlistSong | null;
  onWizardClose: () => void;
  onWizardAutoSave: (updates: Partial<SetlistSong>) => void;
  onWizardGoToTab: (tab: string) => void;

  // Handlers
  onSelectSong: (song: SetlistSong) => void;
  onUpdateSongInSetlist: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => void;
  onDeleteSetlist: () => void;
  onRenameSetlist: (name: string) => void;
  onReorderSongs: (songs: SetlistSong[]) => void;
  onRefreshRepertoire: () => void;
  onAddExistingSong: (song: SetlistSong) => void;
  onGlobalSearchAdd: (song: SetlistSong) => void;
  onSetSongStudioVisibleSongs: (songs: SetlistSong[] | null) => void;
  onSetSongStudioModalGigId: (id: string | 'library' | null) => void;
  onSetSongStudioModalSongId: (id: string | null) => void;
  onSetSongStudioDefaultTab: (tab: StudioTab | undefined) => void;
}

const DashboardModals: React.FC<DashboardModalsProps> = ({
  userId,
  activeSetlist,
  activeSong,
  filteredAndSortedSongs,
  masterRepertoire,
  allSetlists,
  audio,
  globalKeyPreference,
  preventStageKeyOverwrite,
  isSongStudioModalOpen,
  setIsSongStudioModalOpen,
  songStudioModalSongId,
  songStudioModalGigId,
  songStudioDefaultTab,
  songStudioVisibleSongs,
  isPerformanceOverlayOpen,
  setIsPerformanceOverlayOpen,
  isAdminPanelOpen,
  setIsAdminPanelOpen,
  isPreferencesOpen,
  setIsPreferencesOpen,
  isUserGuideOpen,
  setIsUserGuideOpen,
  isKeyManagementOpen,
  setIsKeyManagementOpen,
  isGlobalSearchOpen,
  setIsGlobalSearchOpen,
  isSetlistSortModalOpen,
  setIsSetlistSortModalOpen,
  isSetlistSettingsOpen,
  setIsSetlistSettingsOpen,
  isMDAuditOpen,
  setIsMDAuditOpen,
  isGigPlannerOpen,
  setIsGigPlannerOpen,
  isShortcutSheetOpen,
  setIsShortcutSheetOpen,
  isStorageAuditOpen,
  setIsStorageAuditOpen,
  activeSetGroup,
  setActiveSetGroup,
  auditData,
  isAuditLoading,
  isWizardStandaloneOpen,
  wizardStandaloneSong,
  onWizardClose,
  onWizardAutoSave,
  onWizardGoToTab,
  onSelectSong,
  onUpdateSongInSetlist,
  onUpdateSetlistSongs,
  onDeleteSetlist,
  onRenameSetlist,
  onReorderSongs,
  onRefreshRepertoire,
  onAddExistingSong,
  onGlobalSearchAdd,
  onSetSongStudioVisibleSongs,
  onSetSongStudioModalGigId,
  onSetSongStudioModalSongId,
  onSetSongStudioDefaultTab,
}) => {
  const handleCloseSongStudio = () => {
    setIsSongStudioModalOpen(false);
    onSetSongStudioModalGigId(null);
    onSetSongStudioModalSongId(null);
    onSetSongStudioDefaultTab(undefined);
    onSetSongStudioVisibleSongs(null);
  };

  return (
    <>
      <SongStudioModal
        isOpen={isSongStudioModalOpen}
        onClose={handleCloseSongStudio}
        gigId={songStudioModalGigId}
        songId={songStudioModalSongId}
        visibleSongs={songStudioVisibleSongs || (activeSetlist ? filteredAndSortedSongs : masterRepertoire)}
        onSelectSong={(id) => onSetSongStudioModalSongId(id)}
        allSetlists={allSetlists}
        masterRepertoire={masterRepertoire}
        defaultTab={songStudioDefaultTab}
        audioEngine={audio}
        preventStageKeyOverwrite={preventStageKeyOverwrite}
      />

      {isPerformanceOverlayOpen && activeSetlist && activeSong && (
        <PerformanceOverlay
          songs={activeSetGroup ? filteredAndSortedSongs.filter(s => s.set_group === activeSetGroup) : activeSetlist.songs}
          currentIndex={(activeSetGroup ? filteredAndSortedSongs.filter(s => s.set_group === activeSetGroup) : activeSetlist.songs).findIndex(s => s.id === activeSong.id)}
          isPlaying={audio.isPlaying}
          progress={audio.progress}
          duration={audio.duration}
          onTogglePlayback={audio.togglePlayback}
          onNext={() => {
            const songs = activeSetGroup ? filteredAndSortedSongs.filter(s => s.set_group === activeSetGroup) : activeSetlist.songs;
            const idx = songs.findIndex(s => s.id === activeSong.id);
            if (idx !== -1 && idx < songs.length - 1) {
              onSelectSong(songs[idx + 1]);
            } else if (songs.length > 0) {
              onSelectSong(songs[0]);
            }
          }}
          onPrevious={() => {
            const songs = activeSetGroup ? filteredAndSortedSongs.filter(s => s.set_group === activeSetGroup) : activeSetlist.songs;
            const idx = songs.findIndex(s => s.id === activeSong.id);
            if (idx > 0) {
              onSelectSong(songs[idx - 1]);
            } else if (songs.length > 0) {
              onSelectSong(songs[songs.length - 1]);
            }
          }}
          onShuffle={() => {}}
          onClose={() => {
            setIsPerformanceOverlayOpen(false);
            setActiveSetGroup(null);
          }}
          onUpdateSong={onUpdateSongInSetlist}
          onUpdateKey={async (id, targetKey) => {
            const song = activeSetlist.songs.find(s => s.id === id);
            if (song) {
              const newPitch = calculateSemitones(song.originalKey || 'C', targetKey);
              await onUpdateSongInSetlist(id, { targetKey, pitch: newPitch });
            }
          }}
          analyzer={audio.analyzer}
          gigId={activeSetlist.id}
          isLoadingAudio={audio.isLoadingAudio}
        />
      )}

      <AdminPanel 
        isOpen={isAdminPanelOpen} 
        onClose={() => setIsAdminPanelOpen(false)} 
        onRefreshRepertoire={onRefreshRepertoire} 
        repertoire={masterRepertoire} 
      />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      <KeyManagementModal 
        isOpen={isKeyManagementOpen} 
        onClose={() => setIsKeyManagementOpen(false)} 
        repertoire={masterRepertoire} 
        onUpdateKey={async (songId, updates) => { 
          if (!userId) return; 
          await syncToMasterRepertoire(userId, [{ ...updates, id: songId }]); 
          await onRefreshRepertoire(); 
        }} 
        keyPreference={globalKeyPreference} 
      />
      <GlobalSearchModal 
        isOpen={isGlobalSearchOpen} 
        onClose={() => setIsGlobalSearchOpen(false)} 
        onAddSong={onGlobalSearchAdd} 
        repertoire={masterRepertoire} 
        onAddExistingSong={onAddExistingSong} 
      />
      
      {activeSetlist && (
        <>
          <SetlistSortModal 
            isOpen={isSetlistSortModalOpen} 
            onClose={() => setIsSetlistSortModalOpen(false)} 
            songs={activeSetlist.songs} 
            onReorder={onReorderSongs} 
            setlistName={activeSetlist.name} 
            masterRepertoire={masterRepertoire} 
            onAddSongs={async (songs) => { 
              for (const s of songs) await onUpdateSetlistSongs(activeSetlist.id, s, 'add'); 
            }} 
          />
          <SetlistSettingsModal 
            isOpen={isSetlistSettingsOpen} 
            onClose={() => setIsSetlistSettingsOpen(false)} 
            setlistId={activeSetlist.id} 
            setlistName={activeSetlist.name} 
            onDelete={onDeleteSetlist} 
            onRename={onRenameSetlist} 
            onRefresh={onRefreshRepertoire} 
          />
        </>
      )}
      <MDAuditModal 
        isOpen={isMDAuditOpen} 
        onClose={() => setIsMDAuditOpen(false)} 
        auditData={auditData} 
        isLoading={isAuditLoading} 
      />
      <GigPlannerModal 
        isOpen={isGigPlannerOpen} 
        onClose={() => setIsGigPlannerOpen(false)} 
        repertoire={masterRepertoire} 
        onAddExternalSong={async () => {}} 
        onAddLibrarySong={async () => {}} 
        onBuildGig={async () => {}} 
      />
      <ShortcutCheatSheet 
        isOpen={isShortcutSheetOpen} 
        onClose={() => setIsShortcutSheetOpen(false)} 
      />
      <StorageAuditModal 
        isOpen={isStorageAuditOpen} 
        onClose={() => setIsStorageAuditOpen(false)} 
        repertoire={masterRepertoire} 
      />

      {wizardStandaloneSong && (
        <ReadinessWizardModal
          isOpen={isWizardStandaloneOpen}
          onClose={onWizardClose}
          formData={wizardStandaloneSong}
          handleAutoSave={onWizardAutoSave}
          onSwitchTab={onWizardGoToTab}
        />
      )}
    </>
  );
};

export default DashboardModals;
