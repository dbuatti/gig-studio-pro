"use client";

import React from 'react';
import { Music, Check, Loader2, Trash2, GripVertical, ListMusic, Clock, SlidersHorizontal, AlertTriangle, Edit3, X, Plus, Search, ShieldCheck, CloudDownload, AlertTriangle, Link2, FileText, Guitar, Type, AlignCenter, AlignLeft, AlignRight, Download, Palette, Hash, Music2, LinkIcon, Play, Pause, RotateCcw, Settings2, Globe, Zap, ListPlus, ClipboardPaste, AlertCircle, ExternalLink, Maximize, Minimize, Eye, UploadCloud, CheckCircle2, Tag, X as XIcon, Ruler, Edit3 as Edit3Icon, Link2Off, FileX2, FileCheck2, Volume2, Waves, Activity, Target, Monitor, BookOpen, Keyboard, Lightbulb, LayoutDashboard, Rocket, Settings, LogOut, Database, Terminal, Upload, HardDriveDownload, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import { calculateReadiness } from '@/utils/repertoireSync';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useSetlist } from '@/hooks/useSetlist';
import { useRepertoire } from '@/hooks/useRepertoire';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { transposeKey } from '@/utils/keyUtils';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { calculateSemitones } from '@/utils/keyUtils';
import { transposeChords, extractKeyFromChords, isChordLine } from '@/utils/chordUtils';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';
import { LinkEditorOverlay, SheetLink } from './LinkEditorOverlay';
import LinkSizeModal from './LinkSizeModal';
import ResourceAuditModal from './ResourceAuditModal';
import KeyManagementModal from './KeyManagementModal';
import SetlistSettingsModal from './SetlistSettingsModal';
import SetlistSortModal from './SetlistSortModal';
import ImportSetlist from './ImportSetlist';
import GigSessionManager from './GigSessionManager';
import SetlistSelector from './SetlistSelector';
import { Youtube } from 'lucide-react';
import YoutubeMediaManager from './YoutubeMediaManager';
import SongSuggestions from './SongSuggestions';
import SongAnalysisTools from './SongAnalysisTools';
import SongAudioControls from './SongAudioControls';
import SongAudioPlaybackTab from './SongAudioPlaybackTab';
import SongChartsTab from './SongChartsTab';
import SongConfigTab from './SongConfigTab';
import SongDetailsTab from './SongDetailsTab';
import SongStudioView from './SongStudioView';
import SongSearch from './SongSearch';
import SheetReaderHeader from './SheetReaderHeader';
import SheetReaderSidebar from './SheetReaderSidebar';
import SheetReaderAudioPlayer from './SheetReaderAudioPlayer';
import PerformanceOverlay from './PerformanceOverlay';
import FloatingCommandDock from './FloatingCommandDock';
import UserGuideModal from './UserGuideModal';
import AdminPanel from './AdminPanel';
import RepertoirePicker from './RepertoirePicker';
import ProSyncSearch from './ProSyncSearch';
import SetlistFilters, { FilterState, DEFAULT_FILTERS } from './SetlistFilters';
import SetlistExporter from './SetlistExporter';
import PublicRepertoireView from './PublicRepertoireView';
import SongTagManager from './SongTagManager';
import SongAssetMatrix from './SongAssetMatrix';
import SheetMusicRecommender from './SheetMusicRecommender';
import UGChordsEditor from './UGChordsEditor';
import UGChordsReader from './UGChordsReader';
import SearchHighlight from './SearchHighlight';
import CustomProgress from './CustomProgress';
import CustomSlider from './CustomSlider';
import SupportBanner from './SupportBanner';
import AuthProvider, { useAuth } from './AuthProvider';
import { useToneAudio, AudioEngineControls } from '@/hooks/use-tone-audio';
import { useReaderSettings, ReaderResourceForce } from '@/hooks/use-reader-settings';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import { useFollow } from '@/hooks/use-follow';
import { useSettings, GlobalSettings, KeyPreference } from '@/hooks/use-settings';
import { useSetlist } from '@/hooks/useSetlist';
import { useRepertoire } from '@/hooks/useRepertoire';
import { useToneAudio as useToneAudioHook } from '@/hooks/use-tone-audio';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/lib/database.types';

// --- TYPES ---

export type UGChordsConfig = {
  fontFamily: string;
  fontSize: number;
  chordBold: boolean;
  chordColor: string;
  lineSpacing: number;
  textAlign: 'left' | 'center' | 'right';
};

export type SetlistSong = {
  id: string;
  master_id?: string;
  name: string;
  artist: string;
  originalKey: string | null;
  targetKey: string | null;
  pitch: number;
  previewUrl: string | null;
  audio_url: string | null;
  youtubeUrl: string | null;
  ugUrl: string | null;
  appleMusicUrl: string | null;
  pdfUrl: string | null;
  leadsheetUrl: string | null;
  sheet_music_url: string | null;
  bpm: string | null;
  genre: string | null;
  duration_seconds: number;
  notes: string | null;
  lyrics: string | null;
  user_tags: string[] | null;
  resources: string[];
  isPlayed: boolean;
  isConfirmed: boolean;
  isKeyConfirmed: boolean;
  isMetadataConfirmed: boolean;
  isApproved: boolean;
  is_pitch_linked: boolean;
  is_ug_chords_present: boolean;
  is_sheet_verified: boolean;
  is_ready_to_sing: boolean | null;
  preferred_reader: 'ug' | 'ls' | 'fn' | null;
  ug_chords_text: string | null;
  ug_chords_config: UGChordsConfig | null;
  highest_note_original: string | null;
  extraction_status: 'idle' | 'PENDING' | 'queued' | 'processing' | 'completed' | 'failed' | null;
  last_sync_log: string | null;
  metadata_source: string | null;
  sync_status: string | null;
  auto_synced: boolean | null;
  fineTune: number | null;
  tempo: number | null;
  volume: number | null;
  key_preference: 'sharps' | 'flats' | 'neutral' | null;
  extraction_error: string | null;
};

export type Setlist = Database['public']['Tables']['setlists']['Row'] & {
  songs: SetlistSong[];
};

// --- COMPONENTS (Placeholder/Export only) ---

export const SetlistManager: React.FC<{ initialSetlistId: string | null, initialGigId: string | null }> = () => {
  // Placeholder implementation
  return <div className="p-4 text-center text-sm text-slate-500">SetlistManager Component Placeholder</div>;
};

export default SetlistManager;