"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  ArrowLeft, 
  Activity, 
  Check, 
  Sparkles, 
  ListPlus, 
  Loader2, 
  ChevronRight, 
  Save,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSettings } from '@/hooks/use-settings';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { SetlistSong } from '@/components/SetlistManager';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { showSuccess, showError } from '@/utils/toast';
import StudioTabContent from '@/components/StudioTabContent';
import SongConfigTab from '@/components/SongConfigTab';
import ProSyncSearch from '@/components/ProSyncSearch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StudioTab = 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';

const SongStudio = () => {
  const { gigId, songId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalPreference } = useSettings();
  const audio = useToneAudio();
  
  const [song, setSong] = useState<SetlistSong | null>(null);
  const [gigName, setGigName] = useState<string>("");
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>('audio');
  const [loading, setLoading] = useState(true);
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  const [isProSyncing, setIsProSyncing] = useState(false);
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  
  const tabOrder: StudioTab[] = isMobile 
    ? ['audio', 'config', 'details', 'charts', 'lyrics', 'visual', 'library'] 
    : ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

  const dragX = useMotionValue(0);
  const opacity = useTransform(dragX, [0, 100], [1, 0.5]);

  // Fetch song and gig context
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !gigId || !songId) return;
      
      try {
        const { data: gigData, error: gigError } = await supabase
          .from('setlists')
          .select('*')
          .eq('id', gigId)
          .single();

        if (gigError) throw gigError;
        setGigName(gigData.name);

        const songsList = gigData.songs as SetlistSong[];
        const targetSong = songsList.find(s => s.id === songId);

        if (!targetSong) {
          showError("Song not found in this gig.");
          navigate('/dashboard');
          return;
        }

        setSong(targetSong);
        setFormData({
          ...targetSong,
          is_pitch_linked: targetSong.is_pitch_linked ?? true,
          ug_chords_config: targetSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG
        });

        if (targetSong.previewUrl) {
          await audio.loadFromUrl(targetSong.previewUrl, targetSong.pitch || 0);
        }
      } catch (err) {
        console.error("Studio Fetch Error:", err);
        showError("Failed to load song data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, gigId, songId]);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const handleAutoSave = useCallback(async (updates: Partial<SetlistSong>) => {
    if (!song || !gigId) return;

    setFormData(prev => {
      const next = { ...prev, ...updates };
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // 1. Update the master repertoire first
          const masterFields = ['name', 'artist', 'previewUrl', 'youtubeUrl', 'originalKey', 'targetKey', 'pitch', 'bpm', 'lyrics', 'pdfUrl', 'ugUrl', 'isMetadataConfirmed', 'isKeyConfirmed', 'isApproved', 'duration_seconds', 'preferred_reader', 'ug_chords_text', 'ug_chords_config', 'is_pitch_linked'];
          const needsMasterSync = Object.keys(updates).some(key => masterFields.includes(key));
          
          let updatedSong = { ...song, ...next };

          if (needsMasterSync && user) {
            const synced = await syncToMasterRepertoire(user.id, [updatedSong]);
            updatedSong = { ...updatedSong, master_id: synced[0].master_id };
          }

          // 2. Update the gig's JSONB
          const { data: gigData } = await supabase.from('setlists').select('songs').eq('id', gigId).single();
          if (gigData) {
            const updatedSongs = (gigData.songs as SetlistSong[]).map(s => 
              s.id === song.id ? updatedSong : s
            );
            await supabase.from('setlists').update({ 
              songs: updatedSongs,
              updated_at: new Date().toISOString() 
            }).eq('id', gigId);
          }
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 1000);

      return next;
    });
  }, [song, gigId, user]);

  const handleBack = () => {
    // Force one final save before navigating
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    navigate('/dashboard');
  };

  const handleSelectProSync = async (itunesData: any) => {
    setIsProSyncSearchOpen(false);
    setIsProSyncing(true);
    try {
      const basicUpdates: Partial<SetlistSong> = {
        name: itunesData.trackName,
        artist: itunesData.artistName,
        genre: itunesData.primaryGenreName,
        appleMusicUrl: itunesData.trackViewUrl,
        user_tags: [...(formData.user_tags || []), itunesData.primaryGenreName],
        isMetadataConfirmed: true
      };
      
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { 
        body: { queries: [`${itunesData.trackName} by ${itunesData.artistName}`] } 
      });
      
      if (error) throw error;
      const aiResult = Array.isArray(data) ? data[0] : data;
      
      const finalUpdates = { 
        ...basicUpdates, 
        originalKey: aiResult?.originalKey || formData.originalKey, 
        targetKey: aiResult?.originalKey || formData.targetKey, 
        bpm: aiResult?.bpm?.toString() || formData.bpm, 
        pitch: 0 
      };
      
      handleAutoSave(finalUpdates);
      audio.setPitch(0);
      showSuccess(`Synced "${itunesData.trackName}"`);
    } catch (err) {
      showError("Pro Sync failed.");
    } finally {
      setIsProSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Initializing Studio Engine...</p>
      </div>
    );
  }

  const readiness = calculateReadiness(formData);
  const readinessColor = readiness === 100 ? 'bg-emerald-500' : readiness > 60 ? 'bg-indigo-500' : 'bg-slate-500';

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      style={{ opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.15 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) handleBack();
      }}
      className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden fixed inset-0 z-[100]"
    >
      {/* Mobile-Optimized Header */}
      <header className="h-20 bg-slate-900 border-b border-white/5 flex items-center justify-between px-4 md:px-8 shrink-0 relative z-50">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-white/10 transition-all active:scale-90 flex items-center justify-center p-0"
          >
            <ArrowLeft className="w-6 h-6 text-slate-400" />
          </Button>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] truncate max-w-[200px]">
              Back to {gigName}
            </p>
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight truncate max-w-[250px] leading-tight">
              {formData.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {!isMobile && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
                <ShieldCheck className={cn("w-3.5 h-3.5", readiness === 100 ? "text-emerald-500" : "text-indigo-400")} />
                <span className="text-[10px] font-black font-mono">{readiness}% READY</span>
             </div>
          )}
          <Button 
            onClick={() => setIsProSyncSearchOpen(true)}
            className={cn(
              "h-11 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 px-4 md:px-6 shadow-lg",
              formData.isMetadataConfirmed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {isProSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : formData.isMetadataConfirmed ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{formData.isMetadataConfirmed ? "SYNCED" : "PRO SYNC"}</span>
          </Button>
        </div>
      </header>

      {/* Progress Line */}
      <div className="h-0.5 w-full bg-white/5 overflow-hidden">
        <motion.div 
          className={cn("h-full", readinessColor)}
          initial={{ width: 0 }}
          animate={{ width: `${readiness}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (Desktop Only) */}
        {!isMobile && (
          <aside className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            <SongConfigTab 
              song={song}
              formData={formData}
              handleAutoSave={handleAutoSave}
              onUpdateKey={(id, key) => handleAutoSave({ targetKey: key })}
              setPitch={audio.setPitch}
              setTempo={audio.setTempo}
              setVolume={audio.setVolume}
              setFineTune={audio.setFineTune}
              currentBuffer={audio.currentBuffer}
              isPlaying={audio.isPlaying}
              progress={audio.progress}
              duration={audio.duration}
              togglePlayback={audio.togglePlayback}
              stopPlayback={audio.stopPlayback}
              isMobile={false}
            />
          </aside>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <nav className="h-16 md:h-20 bg-black/20 border-b border-white/5 flex items-center px-4 md:px-12 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex gap-8 md:gap-12">
              {tabOrder.map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.4em] transition-all border-b-4 h-16 md:h-20 flex items-center shrink-0",
                    activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                  )}
                >
                  {tab === 'config' ? 'SETTINGS' : tab.toUpperCase()}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 overflow-y-auto p-4 md:p-12 relative custom-scrollbar">
            <StudioTabContent 
              activeTab={activeTab}
              song={song}
              formData={formData}
              handleAutoSave={handleAutoSave}
              onUpdateKey={(id, key) => handleAutoSave({ targetKey: key })}
              audioEngine={audio}
              isMobile={isMobile}
              onLoadAudioFromUrl={audio.loadFromUrl}
              setPreviewPdfUrl={() => {}}
              isFramable={() => true}
              activeChartType={activeChartType}
              setActiveChartType={setActiveChartType}
              handleUgPrint={() => {}}
              handleDownloadAll={async () => {}}
              onSwitchTab={setActiveTab}
            />
          </div>
        </div>
      </div>

      {/* Pro Sync Search Portal */}
      <ProSyncSearch 
        isOpen={isProSyncSearchOpen} 
        onClose={() => setIsProSyncSearchOpen(false)} 
        onSelect={handleSelectProSync} 
        initialQuery={`${formData.artist} ${formData.name}`} 
      />
    </motion.div>
  );
};

export default SongStudio;