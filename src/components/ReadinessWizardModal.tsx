"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Check, ArrowRight, Target, ShieldCheck,
  FileText, Music, Mic2, Music2, X, Upload, Loader2, FileType, Search, Play, Pause, Download
} from 'lucide-react';
import { cn } from "@/lib/utils";
import MasteryRating from './MasteryRating';
import { SetlistSong } from './SetlistManager';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { r2Storage } from '@/utils/r2Storage';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey } from '@/utils/keyUtils';
import { transposeChords } from '@/utils/chordUtils';
import { cleanLyrics } from '@/utils/lyricsCleaner';

type StudioTab = 'config' | 'audio' | 'details' | 'visual' | 'lyrics' | 'charts' | 'library';

interface SubTaskDef {
  id: string;
  label: string;
  isDone: (f: Partial<SetlistSong>) => boolean;
}

interface StepConfig {
  id: string;
  tab: StudioTab;
  icon: React.ReactNode;
  title: string;
  instructions: string;
  subtasks: SubTaskDef[];
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const READER_OPTIONS = [
  { value: 'ug', label: 'UG Chords' },
  { value: 'ls', label: 'Lead Sheet' },
  { value: 'fs', label: 'Full Score' },
  { value: 'fn', label: 'None (memorised)' },
  { value: 'unsure', label: 'Unsure' },
];

const STEPS: StepConfig[] = [
  {
    id: 'reader_ready', tab: 'details',
    icon: <FileText className="w-5 h-5" />,
    title: 'Get Sheet Music',
    instructions: 'Drop a PDF here or paste a URL. Then choose how you want to read it on stage.',
    subtasks: [
      { id: 'reader_ready.1', label: 'Upload sheet music / PDF', isDone: f => !!(f.pdfUrl || f.leadsheetUrl) },
      { id: 'reader_ready.2', label: 'Set preferred reader format', isDone: f => !!f.preferred_reader },
    ],
  },
  {
    id: 'key_and_range_confirmed', tab: 'config',
    icon: <Music className="w-5 h-5" />,
    title: 'Key & Range',
    instructions: 'Set the original key, enter your highest note, then pick and confirm your stage key.',
    subtasks: [
      { id: 'key.1', label: 'Set original key', isDone: f => !!f.originalKey && f.originalKey !== 'TBC' },
      { id: 'key.3', label: 'Enter highest note', isDone: f => !!f.highest_note_original && /^[A-G][#b]?[0-8]$/.test(f.highest_note_original) },
      { id: 'key.4', label: 'Confirm stage key', isDone: f => !!f.isKeyConfirmed },
    ],
  },
  {
    id: 'every_section_checked', tab: 'lyrics',
    icon: <Mic2 className="w-5 h-5" />,
    title: 'Review Lyrics',
    instructions: 'Paste the full lyrics so you can scroll through every verse and bridge.',
    subtasks: [
      { id: 'lyrics.1', label: 'Add full lyrics', isDone: f => !!(f.lyrics && f.lyrics.length > 20) },
    ],
  },
  {
    id: 'structure_marked', tab: 'charts',
    icon: <Music2 className="w-5 h-5" />,
    title: 'Mark Structure',
    instructions: 'Paste chord chart and add section labels so you know where you are at a glance.',
    subtasks: [
      { id: 'structure.1', label: 'Add chords or upload chart', isDone: f => !!(f.ug_chords_text && f.ug_chords_text.length > 10) },
    ],
  },
];

const TAB_LABELS: Record<StudioTab, string> = {
  config: 'Config', audio: 'Audio', details: 'Details',
  visual: 'Visual', lyrics: 'Lyrics', charts: 'Charts', library: 'Library',
};

interface ReadinessWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onSwitchTab: (tab: string) => void;
}

const ReadinessWizardModal: React.FC<ReadinessWizardModalProps> = ({
  isOpen,
  onClose,
  formData,
  handleAutoSave,
  onSwitchTab,
}) => {
  const { user } = useAuth();
  const checked = formData.readiness_checklist || [];
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [activeView, setActiveView] = useState<'summary' | 'lyrics' | 'chords'>('summary');
  const [navigateToStepId, setNavigateToStepId] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'score' | 'leadsheet'>('score');

  const uncheckedStep = navigateToStepId
    ? STEPS.find(s => s.id === navigateToStepId) || STEPS.find(s => !checked.includes(s.id)) || null
    : STEPS.find(s => !checked.includes(s.id)) || null;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const grainPlayerRef = useRef<Tone.GrainPlayer | null>(null);
  const toneStartedRef = useRef(false);
  const isToneBusyRef = useRef(false);
  const currentPitchRef = useRef(0);
  const rafRef = useRef<number>(0);
  const playStartRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const isDraggingRef = useRef(false);
  const loadedAudioUrlRef = useRef('');
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytResults, setYtResults] = useState<Record<string, unknown>[]>([]);
  const [showYtResults, setShowYtResults] = useState(false);
  const [isQueuingExtraction, setIsQueuingExtraction] = useState(false);
  const ytSearchInitiated = useRef(false);

  const hasYoutube = !!(formData.youtubeUrl || formData.ugUrl);
  const ytFailed = hasYoutube && formData.extraction_status === 'failed';
  const hasAudio = formData.extraction_status === 'completed' && !!formData.audio_url;
  const audioUrl = formData.audio_url || formData.previewUrl || '';

  const togglePlay = useCallback(async () => {
    console.log('[slider] togglePlay called, audioUrl:', !!audioUrl, 'isToneBusy:', isToneBusyRef.current, 'player:', !!grainPlayerRef.current, 'playerState:', grainPlayerRef.current?.state, 'isPlaying:', isPlaying);
    if (!audioUrl || isToneBusyRef.current) return;
    isToneBusyRef.current = true;
    try {
      if (!toneStartedRef.current) {
        await Tone.start();
        toneStartedRef.current = true;
      }
      const targetPitch = formData.pitch || 0;

      // If audio source changed, dispose old player and load fresh
      if (grainPlayerRef.current && loadedAudioUrlRef.current !== audioUrl) {
        grainPlayerRef.current.stop();
        grainPlayerRef.current.dispose();
        grainPlayerRef.current = null;
        loadedAudioUrlRef.current = audioUrl;
        elapsedBeforePauseRef.current = 0;
      }

      if (grainPlayerRef.current) {
        if (grainPlayerRef.current.state === 'started') {
          console.log('[slider] stopping (was started)');
          grainPlayerRef.current.stop();
          elapsedBeforePauseRef.current += (performance.now() - playStartRef.current) / 1000;
          setIsPlaying(false);
          cancelAnimationFrame(rafRef.current);
        } else {
          console.log('[slider] starting (was stopped), offset:', elapsedBeforePauseRef.current);
          grainPlayerRef.current.stop();
          grainPlayerRef.current.detune = targetPitch * 100;
          grainPlayerRef.current.start(0, elapsedBeforePauseRef.current);
          playStartRef.current = performance.now();
          setIsPlaying(true);
        }
      } else {
        console.log('[slider] creating new player from', audioUrl);
        const resp = await fetch(audioUrl);
        const buffer = await resp.arrayBuffer();
        const audioBuffer = await Tone.getContext().decodeAudioData(buffer);
        setDuration(audioBuffer.duration);
        const player = new Tone.GrainPlayer(audioBuffer).toDestination();
        player.grainSize = 0.18;
        player.overlap = 0.1;
        player.detune = targetPitch * 100;
        player.onstop = () => { setIsPlaying(false); cancelAnimationFrame(rafRef.current); elapsedBeforePauseRef.current = 0; };
        grainPlayerRef.current = player;
        loadedAudioUrlRef.current = audioUrl;
        player.start(0, 0);
        playStartRef.current = performance.now();
        elapsedBeforePauseRef.current = 0;
        setCurrentTime(0);
        setIsPlaying(true);
      }
      currentPitchRef.current = targetPitch;
    } finally {
      isToneBusyRef.current = false;
    }
  }, [audioUrl, formData.pitch]);

  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const elapsed = (performance.now() - playStartRef.current) / 1000 + elapsedBeforePauseRef.current;
      const t = Math.min(elapsed, duration || Infinity);
      if (Math.abs(t - currentTime) > 0.5) console.log('[slider] tick big jump:', currentTime, '->', t);
      setCurrentTime(t);
      if (!isDraggingRef.current) setDisplayTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, duration]);

  const seekTo = useCallback((time: number) => {
    console.log('[slider] seekTo', time, 'hasPlayer:', !!grainPlayerRef.current, 'playerState:', grainPlayerRef.current?.state, 'isDragging:', isDraggingRef.current);
    if (grainPlayerRef.current) {
      const wasPlaying = grainPlayerRef.current.state === 'started';
      grainPlayerRef.current.stop();
      grainPlayerRef.current.start(0, time);
      elapsedBeforePauseRef.current = time;
      playStartRef.current = performance.now();
      setCurrentTime(time);
      if (!wasPlaying) setIsPlaying(true);
    }
  }, []);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  const setAudioPitch = useCallback((semitones: number) => {
    currentPitchRef.current = semitones;
    if (grainPlayerRef.current) {
      grainPlayerRef.current.detune = semitones * 100;
    }
  }, []);

  const performYtSearch = useCallback(async () => {
    if (!formData.name) return;
    const searchTerm = `${formData.artist || ''} ${formData.name} official music video`;
    setIsSearchingYt(true);
    setShowYtResults(true);
    ytSearchInitiated.current = true;
    try {
      const { data: searchData, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: searchTerm }
      });
      if (!error && searchData?.items?.length > 0) {
        setYtResults(searchData.items.map((item: Record<string, unknown>) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          author: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url,
        })));
        setIsSearchingYt(false);
        return;
      }
    } catch {}
    // Invidious fallback
    try {
      const instances = ['https://iv.ggtyler.dev', 'https://yewtu.be', 'https://invidious.flokinet.to'];
      for (const instance of instances) {
        try {
          const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(searchTerm)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const videos = data?.filter?.((i: Record<string, unknown>) => i.type === "video").slice(0, 10);
          if (videos?.length > 0) {
            setYtResults(videos.map((v: Record<string, unknown>) => ({
              videoId: v.videoId,
              title: v.title,
              author: v.author,
              thumbnail: v.videoThumbnails?.[0]?.url,
            })));
            setIsSearchingYt(false);
            return;
          }
        } catch {}
      }
    } catch {}
    setYtResults([]);
    setIsSearchingYt(false);
  }, [formData.name, formData.artist]);

  const handleQueueExtraction = useCallback(async () => {
    const songId = formData.master_id || formData.id;
    if (!formData.youtubeUrl || !user?.id || !songId) {
      showError('Link a YouTube URL first.');
      return;
    }
    const targetUrl = cleanYoutubeUrl(formData.youtubeUrl);
    handleAutoSave({ youtubeUrl: targetUrl });
    setIsQueuingExtraction(true);
    try {
      const { error } = await supabase
        .from('repertoire')
        .update({
          youtube_url: targetUrl,
          extraction_status: 'queued',
          last_sync_log: 'Queued for background audio extraction.',
          audio_url: hasAudio ? null : undefined,
        })
        .eq('id', songId);
      if (error) throw error;
      showSuccess('Audio extraction queued. It will process in the background.');
      showInfo('You can stay here — the audio will update automatically.');
    } catch (err: unknown) {
      showError(`Failed to queue extraction: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsQueuingExtraction(false);
    }
  }, [formData.youtubeUrl, formData.master_id, formData.id, user?.id, hasAudio, handleAutoSave]);

  useEffect(() => {
    return () => {
      if (grainPlayerRef.current) {
        grainPlayerRef.current.stop();
        grainPlayerRef.current.dispose();
        grainPlayerRef.current = null;
      }
    };
  }, []);

  const currentStepIndex = uncheckedStep ? STEPS.indexOf(uncheckedStep) : STEPS.length;
  const currentStep = uncheckedStep || null;
  const completedCount = checked.filter(id => STEPS.some(s => s.id === id)).length;
  const totalCount = STEPS.length;
  const allDone = completedCount === totalCount;

  const totalSubtasks = useMemo(() => STEPS.reduce((acc, s) => acc + s.subtasks.length, 0), []);
  const doneSubtasks = useMemo(() =>
    STEPS.reduce((acc, step) => acc + step.subtasks.filter(s => s.isDone(formData)).length, 0),
  [formData]);

  // Full readiness score matching repertoireSync validators
  const readinessScore = useMemo(() => {
    const checks: [string, boolean][] = [
      ['PDF', !!(formData.pdfUrl || formData.leadsheetUrl)],
      ['Reader', !!formData.preferred_reader && formData.preferred_reader !== 'unsure'],
      ['Orig key', !!formData.originalKey && formData.originalKey !== 'TBC'],
      ['Stage key', !!formData.targetKey],
      ['Highest note', !!formData.highest_note_original && /^[A-G][#b]?[0-8]$/.test(formData.highest_note_original)],
      ['Key confirmed', !!formData.isKeyConfirmed],
      ['Lyrics', !!(formData.lyrics && formData.lyrics.length > 20)],
      ['Chords', !!(formData.ug_chords_text && formData.ug_chords_text.length > 10)],
      ['Notes', !!(formData.notes && formData.notes.length > 5)],
      ['Confidence', (formData.comfort_level || 0) > 0],
      ['Ready', formData.is_ready_to_sing === true],
    ];
    const weight = 100 / checks.length;
    let earned = 0;
    checks.forEach(([, pass], i) => {
      if (i === 9) earned += weight * Math.min(1, (formData.comfort_level || 0) / 100);
      else if (pass) earned += weight;
    });
    return Math.round(Math.min(100, earned));
  }, [formData]);

  const progress = readinessScore;
  const subtaskPct = totalSubtasks > 0 ? Math.round(100 / totalSubtasks) : 0;

  const subtaskStates = useMemo(() => {
    if (!currentStep) return [];
    return currentStep.subtasks.map(s => ({ ...s, done: s.isDone(formData) }));
  }, [formData, currentStep]);

  const allSubtasksDone = subtaskStates.length > 0 && subtaskStates.every(s => s.done);

  // Auto-show summary when song is over 75% ready
  useEffect(() => {
    if (progress >= 75 && !allDone) setShowSummary(true);
  }, []);

  // Auto-complete steps when all sub-tasks are data-complete
  useEffect(() => {
    if (allSubtasksDone && currentStep && !checked.includes(currentStep.id)) {
      const updated = [...checked, currentStep.id];
      handleAutoSave({ readiness_checklist: updated });
    }
  }, [allSubtasksDone, currentStep?.id]);

  // Parse highest note — local state so partial selections don't reset the dropdowns
  const noteMatch = (formData.highest_note_original || '').match(/^([A-G][#b]?)([0-8])$/);
  const [pendingNote, setPendingNote] = useState(noteMatch?.[1] || '');
  const [pendingOctave, setPendingOctave] = useState(noteMatch?.[2] || '');
  useEffect(() => {
    const m = (formData.highest_note_original || '').match(/^([A-G][#b]?)([0-8])$/);
    setPendingNote(m?.[1] || '');
    setPendingOctave(m?.[2] || '');
  }, [formData.highest_note_original]);

  // PDF upload
  const onPdfDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    if (file.type !== 'application/pdf') { showError('Only PDF files are supported.'); return; }

    setPdfUploading(true);
    try {
      const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').trim();
      const artist = sanitize(formData.artist || 'artist');
      const title = sanitize(formData.name || 'track');
      const songId = formData.master_id || formData.id || 'unsaved';
      const typeLabel = uploadType === 'score' ? 'score' : 'leadsheet';
      const fileName = `${artist}_${title}_${typeLabel}.pdf`;
      const folder = `${user.id}/${songId}_${artist}_${title}`;
      const url = await r2Storage.upload(`${folder}/${fileName}`, file);
      const update = uploadType === 'score' ? { pdfUrl: url } : { leadsheetUrl: url };
      handleAutoSave(update);
      showSuccess(uploadType === 'score' ? 'Full score uploaded.' : 'Lead sheet uploaded.');
    } catch (err) {
      showError('PDF upload failed.');
    } finally {
      setPdfUploading(false);
    }
  }, [user, formData, handleAutoSave, uploadType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onPdfDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: pdfUploading,
  });

  const handleGoToTab = () => {
    if (!currentStep) return;
    onClose();
    setTimeout(() => onSwitchTab(currentStep.tab), 100);
  };

  const handleComplete = () => {
    if (!currentStep) return;
    const updated = [...checked, currentStep.id];
    handleAutoSave({ readiness_checklist: updated });
    setJustCompletedId(currentStep.id);
    setNavigateToStepId(null);
    setTimeout(() => setJustCompletedId(null), 700);
    const nextUnchecked = STEPS.find(s => !updated.includes(s.id));
    if (!nextUnchecked) setTimeout(() => setShowCelebration(true), 400);
  };

  const handleClose = () => { onClose(); setShowCelebration(false); };

  const renderStepSummary = () => {
    if (!allSubtasksDone || !currentStep) return null;
    const summaries: Record<string, { label: string; value: string }[]> = {
      reader_ready: [
        { label: 'PDF', value: formData.pdfUrl ? 'Linked' : 'Not linked' },
        { label: 'Reader', value: formData.preferred_reader === 'ug' ? 'UG Chords' : formData.preferred_reader === 'ls' ? 'Lead Sheet' : formData.preferred_reader === 'fs' ? 'Full Score' : formData.preferred_reader === 'fn' ? 'Memorised' : formData.preferred_reader === 'unsure' ? 'Unsure' : 'Not set' },
      ],
      key_and_range_confirmed: [
        { label: 'Original key', value: formatKey(formData.originalKey, formData.key_preference || 'sharps') || '–' },
        { label: 'Stage key', value: formatKey(formData.targetKey, formData.key_preference || 'sharps') || '–' },
        { label: 'Pitch', value: (formData.pitch || 0) > 0 ? '+' + (formData.pitch || 0) + ' ST' : (formData.pitch || 0) + ' ST' },
        { label: 'Highest note', value: (formData.highest_note_original || '–').replace('#', '\u266F') },
      ],
      every_section_checked: [
        { label: 'Lyrics', value: formData.lyrics ? formData.lyrics.length + ' chars' : 'Not added' },
      ],
      structure_marked: [
        { label: 'Chords', value: formData.ug_chords_text ? formData.ug_chords_text.length + ' chars' : 'Not added' },
      ],
    };
    const items = summaries[currentStep.id];
    if (!items) return null;
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-indigo-600/10 border border-indigo-500/20 p-4 space-y-2"
      >
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Summary</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
          {items.map(item => (
            <React.Fragment key={item.label}>
              <span className="text-slate-500 font-bold">{item.label}</span>
              <span className="text-white font-black text-right truncate">{item.value}</span>
            </React.Fragment>
          ))}
        </div>
      </motion.div>
    );
  };

  // ── Inline inputs ──
  const renderInlineInput = (subId: string, done: boolean) => {
    if (done && subId !== 'reader_ready.1' && subId !== 'lyrics.1') return null;

    switch (subId) {
      // 1.1 PDF upload
      case 'reader_ready.1': {
        const googleSearch = () => {
          const query = encodeURIComponent(`${formData.name || ''} ${formData.artist || ''} sheet music filetype:pdf`);
          window.open(`https://www.google.com/search?q=${query}`, '_blank');
        };
        if (done && (formData.pdfUrl || formData.leadsheetUrl)) {
          const linkUrl = formData.pdfUrl || formData.leadsheetUrl || '';
          const linkLabel = formData.pdfUrl ? 'Open Full Score' : 'Open Lead Sheet';
          return (
            <div className="mt-2 flex items-center gap-2">
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[9px] font-black uppercase tracking-widest transition-all"
              >
                <FileType className="w-3.5 h-3.5" /> {linkLabel}
              </a>
            </div>
          );
        }
        return (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1.5">
              {[
                { value: 'score', label: 'Full Score' },
                { value: 'leadsheet', label: 'Lead Sheet' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setUploadType(opt.value as 'score' | 'leadsheet')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all flex-1",
                    uploadType === opt.value
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div
              {...getRootProps()}
              className={cn(
                "p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                isDragActive ? "border-indigo-500 bg-indigo-500/5" : "border-white/10 hover:border-white/20"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg transition-all", isDragActive ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-500")}>
                  {pdfUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : isDragActive ? <Upload className="w-4 h-4" /> : <FileType className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-white">{pdfUploading ? 'Uploading...' : isDragActive ? 'Drop PDF' : 'Drop PDF or click'}</p>
                  {(formData.pdfUrl || formData.leadsheetUrl) && <p className="text-[8px] text-emerald-400 mt-0.5">PDF linked</p>}
                </div>
              </div>
            </div>
            <button onClick={googleSearch} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[9px] font-black uppercase tracking-widest transition-all w-full">
              <Search className="w-3.5 h-3.5" /> Search Google for "{formData.name || 'song'} {formData.artist || ''} sheet music"
            </button>
          </div>
        );
      }

      // 1.2 Preferred reader
      case 'reader_ready.2':
        return (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {READER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                onClick={() => handleAutoSave({ preferred_reader: opt.value as 'ug' | 'ls' | 'fn' | 'fs' | 'unsure' })}
                className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                    formData.preferred_reader === opt.value
                      ? opt.value === 'unsure'
                        ? "bg-amber-600 border-amber-500 text-white"
                        : "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {formData.preferred_reader === 'unsure' && (
              <p className="text-[8px] text-amber-400 font-bold">
                You'll need to choose before a gig — this will flag songs as unready
              </p>
            )}
          </div>
        );

      // 2.1 Original key
      case 'key.1':
        return (
          <div className="mt-2 space-y-2">
            <select
              value={formData.originalKey || ''}
              onChange={e => {
                const newKey = e.target.value;
                handleAutoSave({ originalKey: newKey, targetKey: newKey, pitch: 0 });
              }}
              className="w-28 h-9 bg-black/70 border border-white/10 rounded-xl px-3 text-xs font-black font-mono text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="" className="text-slate-500">Not set</option>
              <option value="TBC" className="bg-slate-900 text-slate-400">Choose later</option>
              {ALL_KEYS_SHARP.map(k => (
                <option key={k} value={k} className="bg-slate-900">{formatKey(k, formData.key_preference || 'sharps')}</option>
              ))}
            </select>
            {formData.originalKey === 'TBC' && (
              <p className="text-[8px] text-amber-400 font-bold">
                Set the original key when you know it — transposition needs a reference
              </p>
            )}
          </div>
        );

      // 2.3 Highest note
      case 'key.3':
        return (
          <div className="mt-2 flex items-center gap-2">
            <select
              value={pendingNote}
              onChange={e => {
                const n = e.target.value;
                setPendingNote(n);
                if (n && pendingOctave) handleAutoSave({ highest_note_original: `${n}${pendingOctave}` });
              }}
              className="w-20 h-9 bg-black/70 border border-white/10 rounded-xl px-3 text-xs font-black font-mono text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-500">Note</option>
              {NOTES.map(n => (
                <option key={n} value={n} className="bg-slate-900">{formatKey(n, formData.key_preference || 'sharps')}</option>
              ))}
            </select>
            <select
              value={pendingOctave}
              onChange={e => {
                const o = e.target.value;
                setPendingOctave(o);
                if (pendingNote && o) handleAutoSave({ highest_note_original: `${pendingNote}${o}` });
              }}
              className="w-16 h-9 bg-black/70 border border-white/10 rounded-xl px-3 text-xs font-black font-mono text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-500">8ve</option>
              {OCTAVES.map(o => (
                <option key={o} value={o} className="bg-slate-900">{o}</option>
              ))}
            </select>
          </div>
        );

      // 2.4 Confirm stage key — defaults to original key
      case 'key.4': {
        const stageKey = formData.targetKey || formData.originalKey || '';
        const keyIndex = ALL_KEYS_SHARP.indexOf(stageKey);
        const hasAudio = !!(formData.audio_url || formData.previewUrl);
        const isMinor = stageKey.endsWith('m');
        const shiftKey = (direction: 1 | -1) => {
          if (keyIndex === -1 || formData.originalKey === 'TBC' || !formData.originalKey) return;
          const baseIndex = isMinor ? keyIndex - 12 : keyIndex;
          const newBaseIndex = (baseIndex + direction + 12) % 12;
          const newKey = isMinor ? ALL_KEYS_SHARP[newBaseIndex + 12] : ALL_KEYS_SHARP[newBaseIndex];
          const semitones = calculateSemitones(formData.originalKey, newKey);
          handleAutoSave({ targetKey: newKey, pitch: semitones });
          setAudioPitch(semitones);
        };
        return (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1 text-[8px] text-slate-500 font-bold">
              <span>Original:</span>
              <span className="text-white font-black">{formatKey(formData.originalKey, formData.key_preference || 'sharps') || '—'}</span>
              {(formData.pitch || 0) !== 0 && (
                <span className="text-emerald-400 font-mono">· {(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => shiftKey(-1)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center text-sm font-black shrink-0" title="Shift down 1 semitone">
                −
              </button>
              <select
                value={stageKey}
                onChange={e => handleAutoSave({ targetKey: e.target.value })}
                className="flex-1 h-8 bg-black/70 border border-white/10 rounded-lg px-2 text-[10px] font-black font-mono text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer text-center"
              >
                <option value="" disabled className="text-slate-500">Key</option>
                {ALL_KEYS_SHARP.map(k => (
                <option key={k} value={k} className="bg-slate-900">{formatKey(k, formData.key_preference || 'sharps')}</option>
              ))}
            </select>
            <button onClick={() => shiftKey(1)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center text-sm font-black shrink-0">
              +
              </button>
              {hasAudio && (
                <button
                  onClick={togglePlay}
                  className={cn(
                    "w-8 h-8 rounded-lg border transition-all flex items-center justify-center shrink-0",
                    isPlaying
                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                  title={isPlaying ? 'Pause' : 'Play song to test key'}
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
              )}
            </div>
            {formData.isKeyConfirmed && formData.targetKey && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                  Stage key: {formatKey(formData.targetKey, formData.key_preference || 'sharps')}
                </span>
                <span className="text-[8px] text-emerald-500/60 ml-auto">Confirmed</span>
              </div>
            )}
            <button
              onClick={() => handleAutoSave({ isKeyConfirmed: !formData.isKeyConfirmed })}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all justify-center",
                formData.isKeyConfirmed
                  ? "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300 w-auto mx-auto text-[8px]"
                  : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 w-full"
              )}
            >
              {formData.isKeyConfirmed ? 'Unconfirm' : 'Tap to confirm stage key'}
            </button>
          </div>
        );
      }

      // 4.1 Lyrics
      case 'lyrics.1':
        return (
          <div className="mt-2 space-y-2">
            <textarea
              placeholder="Paste full lyrics here..."
              value={formData.lyrics || ''}
              onChange={e => handleAutoSave({ lyrics: e.target.value })}
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const cleaned = cleanLyrics(formData.lyrics || '');
                  handleAutoSave({ lyrics: cleaned });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[8px] font-black uppercase tracking-widest transition-all flex-1 justify-center"
              >
                ✕ Clean
              </button>
              <button
                onClick={() => {
                  const q = encodeURIComponent(`${formData.artist || ''} ${formData.name || ''} lyrics`);
                  window.open(`https://www.google.com/search?q=${q}`, '_blank');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[8px] font-black uppercase tracking-widest transition-all flex-1 justify-center"
              >
                <Search className="w-3 h-3" /> Google
              </button>
              <button
                onClick={() => {
                  const slug = ((formData.artist || '') + ' ' + (formData.name || ''))
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['']/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/^-|-$/g, '');
                  window.open('https://genius.com/' + slug + '-lyrics', '_blank');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-[8px] font-black uppercase tracking-widest transition-all flex-1 justify-center"
              >
                Genius
              </button>
            </div>
          </div>
        );

      // 5.1 Chords
      case 'structure.1':
        return (
          <div className="mt-2 space-y-2">
            <textarea
              placeholder="Paste chords or tab here..."
              value={formData.ug_chords_text || ''}
              onChange={e => handleAutoSave({ ug_chords_text: e.target.value })}
              rows={2}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 resize-none"
            />
            <button
                onClick={() => {
                  const q = ((formData.artist || '') + ' ' + (formData.name || ''))
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['']/g, '');
                  window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`, '_blank');
                }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-[8px] font-black uppercase tracking-widest transition-all w-full justify-center"
            >
              <Search className="w-3 h-3" /> Search Ultimate Guitar
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-3xl w-[92vw] h-[90vh] bg-slate-950 text-white border-white/10 rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl [&>button:last-child]:hidden">

        {/* ── Header ── */}
        <div className={cn(
          "shrink-0 relative px-6 md:px-10 py-5 md:py-7",
          allDone ? "bg-gradient-to-r from-emerald-900/60 via-emerald-800/30 to-slate-950" : "bg-gradient-to-r from-indigo-900/60 via-indigo-800/20 to-slate-950"
        )}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full pointer-events-none" />
          {/* ── Readiness progress divider ── */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
            <div
              className={cn(
                "h-full transition-all duration-700 ease-out",
                progress === 100 ? "bg-gradient-to-r from-blue-500 via-indigo-300 to-white" :
                progress >= 75 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                progress >= 50 ? "bg-gradient-to-r from-amber-500 to-yellow-400" :
                progress >= 25 ? "bg-gradient-to-r from-orange-500 to-amber-400" :
                "bg-gradient-to-r from-red-500 to-red-400"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <button onClick={handleClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-colors z-10">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600/20 rounded-xl">
              <Target className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-white truncate pr-16">
                {formData.name || 'Readiness Wizard'}
              </h2>
              <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5">
                <span>{allDone ? 'All steps complete' : `Step ${currentStepIndex + 1} of ${totalCount}`}</span>
                {formData.artist && <><span className="text-slate-700">·</span><span className="truncate">{formData.artist}</span></>}
              </div>
            </div>
          </div>
          {/* ── Header action buttons ── */}
          <div className="flex items-center gap-1.5 mt-4 flex-wrap">
            <div className="relative">
              <button
                onClick={() => {
                  if (!hasYoutube || ytFailed) performYtSearch();
                  else setShowYtResults(!showYtResults);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                  hasYoutube && !ytFailed
                    ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400"
                    : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                )}
                title={ytFailed ? 'YouTube link broken — search again' : hasYoutube ? 'YouTube linked' : 'Find YouTube link'}
              >
                {isSearchingYt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                {ytFailed ? 'Find YT' : hasYoutube ? 'YouTube' : 'Find YT'}
              </button>
              {showYtResults && ytResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                  {ytResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const videoId = r.videoId as string;
                        handleAutoSave({ youtubeUrl: `https://youtube.com/watch?v=${videoId}`, extraction_status: 'idle' });
                        setShowYtResults(false);
                        setYtResults([]);
                      }}
                      className="w-full flex items-center gap-2 p-2 hover:bg-white/5 text-left text-[10px] font-medium text-slate-300 border-b border-white/5 last:border-0"
                    >
                      {r.thumbnail && <img src={r.thumbnail as string} alt="" className="w-8 h-6 rounded object-cover shrink-0" />}
                      <span className="truncate">{r.title as string}</span>
                    </button>
                  ))}
                </div>
              )}
              {showYtResults && !isSearchingYt && ytResults.length === 0 && !hasYoutube && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 p-3 text-[9px] text-slate-500">
                  No results found. Try a different search.
                </div>
              )}
            </div>
            <button
              onClick={handleQueueExtraction}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                hasAudio
                  ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 cursor-default"
                  : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
              )}
              title={hasAudio ? 'Audio extracted' : 'Extract audio from YouTube'}
            >
              {isQueuingExtraction ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {hasAudio ? 'Audio' : isQueuingExtraction ? 'Queuing...' : 'Extract Audio'}
            </button>
            {audioUrl && (
              <button
                onClick={togglePlay}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                  isPlaying
                    ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 animate-pulse"
                    : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                )}
                title={isPlaying ? 'Pause' : 'Play song'}
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {isPlaying ? 'Playing' : 'Play'}
              </button>
            )}
            <button
              onClick={() => { setShowSummary(!showSummary); setActiveView('summary'); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                showSummary
                  ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400"
                  : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
              )}
              title="Song summary"
            >
              {showSummary ? '✕' : 'ℹ'} Summary
            </button>
            {showSummary && (
              <button
                onClick={() => { onClose(); setTimeout(() => onSwitchTab('config'), 100); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border-indigo-500/30 text-indigo-400 text-[8px] font-black uppercase tracking-widest border transition-all"
                title="Open Song Studio"
              >
                Song Studio
              </button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-10 py-4 md:py-5">
          {allDone && !showSummary && !navigateToStepId ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center min-h-[400px] text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.2 }}
                className="p-4 bg-emerald-500/15 rounded-[2rem] mb-6"
              >
                <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-emerald-400" />
              </motion.div>
              <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="text-2xl md:text-3xl font-black text-emerald-400 uppercase tracking-tight mb-2">
                Gig-Ready
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="text-sm text-slate-400 max-w-md leading-relaxed mb-8">
                All steps complete. Your readiness score: {progress}%.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                onClick={() => { setShowSummary(true); setActiveView('summary'); }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
              >
                View Song Summary
              </motion.button>
            </motion.div>
          ) : activeView === 'lyrics' ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-pink-400">Lyrics</h3>
                <button onClick={() => setActiveView('summary')}
                  className="text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-all">
                  ← Back to Summary
                </button>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <pre className="text-sm text-white font-medium leading-relaxed whitespace-pre-wrap font-sans">
                  {formData.lyrics || 'No lyrics added yet.'}
                </pre>
              </div>
            </div>
          ) : activeView === 'chords' ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-orange-400">Transposed Chords</h3>
                <button onClick={() => setActiveView('summary')}
                  className="text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-all">
                  ← Back to Summary
                </button>
              </div>
              <p className="text-[9px] text-slate-500 font-bold mb-3">
                Displayed in stage key ({formatKey(formData.targetKey, formData.key_preference || 'sharps')}) · {(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST from original
              </p>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <pre className="text-sm text-white font-mono leading-relaxed whitespace-pre-wrap">
                  {transposeChords(formData.ug_chords_text || 'No chords added yet.', formData.pitch || 0, formData.key_preference || 'sharps')}
                </pre>
              </div>
            </div>
          ) : showSummary ? (
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Resource badges */}
              <div className="flex flex-wrap gap-1 justify-center">
                {[
                  { label: 'PDF', done: !!(formData.pdfUrl || formData.leadsheetUrl) },
                  { label: 'Reader', done: !!formData.preferred_reader && formData.preferred_reader !== 'unsure' },
                  { label: 'YT', done: !!formData.youtubeUrl },
                  { label: 'Audio', done: !!(formData.audio_url || formData.previewUrl) },
                  { label: 'Lyrics', done: !!(formData.lyrics && formData.lyrics.length > 20) },
                  { label: 'Chords', done: !!(formData.ug_chords_text && formData.ug_chords_text.length > 10) },
                  { label: 'Notes', done: !!(formData.notes && formData.notes.length > 5) },
                ].map(b => {
                  const isView = b.label === 'Lyrics' || b.label === 'Chords';
                  const isActive = (b.label === 'Lyrics' && activeView === 'lyrics') || (b.label === 'Chords' && activeView === 'chords');
                  if (isView) {
                    return (
                      <button key={b.label}
                        onClick={() => setActiveView(b.label.toLowerCase() as 'lyrics' | 'chords')}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                          isActive ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-400" :
                          b.done ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-slate-600 hover:text-slate-300"
                        )}
                      >
                        {b.label} {b.done ? '✓' : '–'}
                      </button>
                    );
                  }
                  return (
                    <span key={b.label} className={cn(
                      "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                      b.done ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-slate-600"
                    )}>
                      {b.label} {b.done ? '✓' : '–'}
                    </span>
                  );
                })}
              </div>

              {/* ── Key & Playback ── */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button onClick={() => {
                    const tk = formData.targetKey || formData.originalKey || '';
                    const isMinor = tk.endsWith('m');
                    const idx = ALL_KEYS_SHARP.indexOf(tk) >= 0 ? ALL_KEYS_SHARP.indexOf(tk) : ALL_KEYS_FLAT.indexOf(tk);
                    if (idx >= 0 && tk && tk !== 'TBC') {
                      const baseIdx = isMinor ? idx - 12 : idx;
                      const newBaseIdx = (baseIdx - 1 + 12) % 12;
                      const newKey = isMinor ? ALL_KEYS_SHARP[newBaseIdx + 12] : ALL_KEYS_SHARP[newBaseIdx];
                      const semitones = calculateSemitones(formData.originalKey, newKey);
                      handleAutoSave({ targetKey: newKey, pitch: semitones });
                      setAudioPitch(semitones);
                    }
                  }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center text-sm font-black shrink-0" title="Semitone down">−</button>
                  {hasAudio && (
                    <button onClick={() => seekTo(Math.max(0, currentTime - 10))}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shrink-0" title="Skip back 10s">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                    </button>
                  )}
                  <button onClick={togglePlay} className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0", isPlaying ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-600 text-white hover:bg-indigo-500")}>
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  {hasAudio && (
                    <button onClick={() => seekTo(Math.min(duration, currentTime + 10))}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shrink-0" title="Skip forward 10s">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                    </button>
                  )}
                  <button onClick={() => {
                    const tk = formData.targetKey || formData.originalKey || '';
                    const isMinor = tk.endsWith('m');
                    const idx = ALL_KEYS_SHARP.indexOf(tk) >= 0 ? ALL_KEYS_SHARP.indexOf(tk) : ALL_KEYS_FLAT.indexOf(tk);
                    if (idx >= 0 && tk && tk !== 'TBC') {
                      const baseIdx = isMinor ? idx - 12 : idx;
                      const newBaseIdx = (baseIdx + 1 + 12) % 12;
                      const newKey = isMinor ? ALL_KEYS_SHARP[newBaseIdx + 12] : ALL_KEYS_SHARP[newBaseIdx];
                      const semitones = calculateSemitones(formData.originalKey, newKey);
                      handleAutoSave({ targetKey: newKey, pitch: semitones });
                      setAudioPitch(semitones);
                    }
                  }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center text-sm font-black shrink-0" title="Semitone up">+</button>
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-sm font-black font-mono text-white">{formatKey(formData.targetKey || formData.originalKey, formData.key_preference || 'sharps') || '–'}</span>
                    <button onClick={() => {
                      const current = formData.targetKey || formData.originalKey || '';
                      const sharpIdx = ALL_KEYS_SHARP.indexOf(current);
                      const flatIdx = ALL_KEYS_FLAT.indexOf(current);
                      const newPref = formData.key_preference === 'flats' ? 'sharps' : 'flats';
                      const newKey = newPref === 'sharps'
                        ? (flatIdx >= 0 ? ALL_KEYS_SHARP[flatIdx] : (sharpIdx >= 0 ? ALL_KEYS_SHARP[sharpIdx] : current))
                        : (sharpIdx >= 0 ? ALL_KEYS_FLAT[sharpIdx] : (flatIdx >= 0 ? ALL_KEYS_FLAT[flatIdx] : current));
                      handleAutoSave({ key_preference: newPref, targetKey: newKey });
                    }} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all font-black font-mono">{formData.key_preference === 'flats' ? '♯' : '♭'}</button>
                    <span className={cn("text-[8px] font-mono font-black", (formData.pitch || 0) !== 0 ? "text-emerald-400" : "text-slate-500")}>
                      {(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST
                    </span>
                    <div className="flex gap-0.5">
                      <button onClick={() => { const p = (formData.pitch || 0) - 12; handleAutoSave({ pitch: p }); setAudioPitch(p); }}
                        className="px-1 py-0.5 rounded text-[7px] font-black font-mono bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all" title="Octave down">−8ve</button>
                      <button onClick={() => { const p = (formData.pitch || 0) + 12; handleAutoSave({ pitch: p }); setAudioPitch(p); }}
                        className="px-1 py-0.5 rounded text-[7px] font-black font-mono bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all" title="Octave up">+8ve</button>
                    </div>
                  </div>
                </div>
                {hasAudio && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-slate-500 w-10 text-right">{formatTime(displayTime)}</span>
                    <input type="range" min={0} max={duration || 1} step={0.1} value={displayTime}
                      onPointerDown={() => { console.log('[slider] pointerDown', displayTime); isDraggingRef.current = true; }}
                      onPointerUp={(e) => { const val = parseFloat(e.currentTarget.value); console.log('[slider] pointerUp', val, 'wasPlaying:', grainPlayerRef.current?.state === 'started'); isDraggingRef.current = false; seekTo(val); }}
                      onChange={e => { const val = parseFloat(e.target.value); console.log('[slider] onChange', val); setDisplayTime(val); }}
                      className="flex-1 h-1 appearance-none bg-white/10 rounded-full cursor-pointer accent-indigo-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400" />
                    <span className="text-[9px] font-mono font-bold text-slate-500 w-10">{formatTime(duration)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[9px] text-slate-500 pt-1 border-t border-white/5">
                  <span className="font-bold">Original:</span><span className="text-white font-black font-mono">{formatKey(formData.originalKey, formData.key_preference || 'sharps') || '–'}</span>
                  <span className="text-slate-700">|</span>
                  <span className="font-bold">Stage:</span><span className="text-white font-black font-mono">{formatKey(formData.targetKey || formData.originalKey, formData.key_preference || 'sharps') || '–'}</span>
                  <span className="text-slate-700">|</span>
                  <span className="font-bold">Shift:</span><span className={cn("font-mono font-black", (formData.pitch || 0) !== 0 ? "text-emerald-400" : "text-slate-500")}>{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
                  <span className="text-slate-700">|</span>
                  <span className="font-bold">Top:</span><span className="text-white font-black font-mono">{(formData.highest_note_original || '–').replace('#', '\u266F')}</span>
                </div>
              </div>

              {/* ── Performance section ── */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-4">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Performance</p>
                
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">Confidence rating</span>
                  <MasteryRating
                    value={formData.comfort_level || 0}
                    onChange={(val) => handleAutoSave({ comfort_level: val })}
                    size="lg"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-300">Ready to sing live</span>
                    <p className="text-[8px] text-slate-600 font-medium mt-0.5">Mark as performance-ready for public gigs</p>
            </div>
            {(formData.pdfUrl || formData.leadsheetUrl) && (
              <a
                href={formData.pdfUrl || formData.leadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all bg-emerald-600/20 border-emerald-500/30 text-emerald-400"
                title="Open sheet music in new tab"
              >
                <FileType className="w-3 h-3" /> Sheet
              </a>
            )}
            <button
                    onClick={() => handleAutoSave({ is_ready_to_sing: formData.is_ready_to_sing === true ? false : true })}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all shrink-0",
                      formData.is_ready_to_sing === true
                        ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400"
                        : "bg-white/5 border-white/10 text-slate-500 hover:border-emerald-500/30 hover:text-emerald-400"
                    )}
                  >
                    {formData.is_ready_to_sing === true ? 'Ready ✓' : 'Mark Ready'}
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-300">Performance notes</span>
                  <textarea
                    placeholder="e.g. The bridge has a 7-beat rest, don't come in early..."
                    value={formData.notes || ''}
                    onChange={e => handleAutoSave({ notes: e.target.value })}
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              {/* Step checklist summary */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Steps</p>
                {STEPS.map((step, i) => {
                  const stepChecked = checked.includes(step.id);
                  const doneCount = step.subtasks.filter(s => s.isDone(formData)).length;
                  const totalSubs = step.subtasks.length;
                  const stepPct = Math.round((doneCount / totalSubs) * 100);
                  const dotColor = stepChecked ? 'bg-emerald-500' :
                    doneCount === 0 ? 'bg-red-500/40' :
                    'bg-amber-500';
                  return (
                      <div key={step.id} className="flex items-center gap-3 text-[10px]">
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black font-mono shrink-0",
                        dotColor,
                        stepChecked || doneCount > 0 ? "text-white" : "text-white/60"
                      )}>
                        {stepChecked ? <Check className="w-3 h-3" /> : doneCount > 0 ? stepPct + '%' : i + 1}
                      </span>
                      <span className={cn("flex-1 font-bold",
                        stepChecked ? "text-emerald-300" : doneCount > 0 ? "text-slate-300" : "text-slate-500"
                      )}>{step.title}</span>
                      {!stepChecked && doneCount > 0 && (
                        <span className="text-[7px] font-mono font-bold text-slate-600">{doneCount}/{totalSubs}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => { onClose(); setTimeout(() => onSwitchTab('config'), 100); }}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black uppercase tracking-widest text-white transition-all">
                  Song Studio
                </button>
                <button onClick={handleClose}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all">
                  Close
                </button>
              </div>
            </div>
          ) : currentStep ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="max-w-2xl mx-auto space-y-8"
              >
                {/* Step title */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div
                      key={`num-${currentStep.id}-${justCompletedId}`}
                      animate={justCompletedId === currentStep.id ? { scale: [1, 1.1, 1] } : {}}
                      className="p-3 bg-indigo-600/20 rounded-2xl text-indigo-400"
                    >
                      {currentStep.icon}
                    </motion.div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Step {currentStepIndex + 1} of {totalCount}</p>
                      <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">{currentStep.title}</h3>
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">{currentStep.instructions}</p>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black font-mono">
                    <span className="text-indigo-400">{doneSubtasks}/{totalSubtasks} done</span>
                    <span className="text-slate-600">
                      {progress}%
                      {totalSubtasks - doneSubtasks > 0 && (
                        <span className="text-amber-400 ml-2">{totalSubtasks - doneSubtasks} remaining</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      layout
                      className={cn(
                        "h-full rounded-full",
                        progress === 100 ? "bg-gradient-to-r from-blue-500 via-indigo-300 to-white" :
                        progress >= 75 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                        progress >= 50 ? "bg-gradient-to-r from-amber-500 to-yellow-400" :
                        progress >= 25 ? "bg-gradient-to-r from-orange-500 to-amber-400" :
                        "bg-gradient-to-r from-red-500 to-red-400"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Sub-tasks */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400">Sub-tasks</p>
                  <div className="space-y-2">
                    {subtaskStates.map((sub, i) => {
                      const subNum = `${currentStepIndex + 1}.${i + 1}`;
                      return (
                        <motion.div
                          key={sub.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className={cn(
                            "rounded-xl border transition-all duration-500",
                            sub.done ? "bg-emerald-600/10 border-emerald-500/30" : "bg-white/5 border-white/5"
                          )}
                        >
                          <div className="flex items-start gap-4 p-4">
                            <motion.div
                              animate={{ backgroundColor: sub.done ? '#10b981' : 'rgba(255,255,255,0.05)', borderColor: sub.done ? '#10b981' : 'rgba(255,255,255,0.15)' }}
                              className={cn(
                                "w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 font-black font-mono text-xs transition-all duration-300",
                                sub.done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white/5 border-white/15 text-slate-500"
                              )}
                            >
                              {sub.done ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                                  <Check className="w-4 h-4" />
                                </motion.div>
                              ) : subNum}
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <span className={cn("text-xs md:text-sm font-bold transition-colors duration-300", sub.done ? "text-emerald-300" : "text-slate-300")}>
                                {sub.label}
                              </span>
                              {(formData.pdfUrl || formData.leadsheetUrl) && (
                                <a href={formData.pdfUrl || formData.leadsheetUrl} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-all"
                                  title="Open sheet music">
                                  <FileType className="w-2.5 h-2.5" /> PDF
                                </a>
                              )}
                              {renderInlineInput(sub.id, sub.done)}
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                              {sub.done ? (
                                <button
                                  onClick={() => {
                                    if (currentStep) {
                                      const clearFields: Record<string, Partial<SetlistSong>> = {
                                        'reader_ready.1': { pdfUrl: '', leadsheetUrl: '' },
                                        'reader_ready.2': { preferred_reader: '' as any },
                                      'key.1': { originalKey: '' },
                                      'key.4': { isKeyConfirmed: false, targetKey: '' },
                                      'lyrics.1': { lyrics: '' },
                                      'structure.1': { ug_chords_text: '' },
                                      };
                                      const isStepChecked = checked.includes(currentStep.id);
                                      handleAutoSave({
                                        ...clearFields[sub.id],
                                        ...(isStepChecked ? { readiness_checklist: checked.filter(id => id !== currentStep.id) } : {}),
                                      });
                                    }
                                  }}
                                  className="shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded self-start bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer transition-all"
                                >
                                  Undo
                                </button>
                              ) : (
                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-slate-600 self-start">
                                  Pending
                                </span>
                              )}
                              <span className="text-[7px] font-mono font-bold text-slate-600">
                                {subtaskPct}%
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Step summary ── */}
                {renderStepSummary()}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleGoToTab}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-600/20">
                    Go to {TAB_LABELS[currentStep.tab]} <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button
                    whileHover={allSubtasksDone ? { scale: 1.02 } : {}}
                    whileTap={allSubtasksDone ? { scale: 0.97 } : {}}
                    onClick={handleComplete}
                    disabled={!allSubtasksDone}
                    className={cn(
                      "flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      allSubtasksDone
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                        : "bg-emerald-600/30 text-emerald-600/50 cursor-not-allowed"
                    )}>
                    <Check className="w-3.5 h-3.5" /> Complete Step <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
                {allSubtasksDone && (
                  <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[9px] text-emerald-500/60 italic text-center">
                    All sub-tasks complete. Tap "Complete Step" to lock it in.
                  </motion.p>
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {/* ── Footer dots ── */}
          <div className="shrink-0 px-6 md:px-10 py-4 bg-slate-900/50 border-t border-white/5 flex items-center justify-center gap-2">
            {STEPS.map((step, i) => {
              const isChecked = checked.includes(step.id);
              const isCurrent = step.id === currentStep?.id;
              const doneSubs = step.subtasks.filter(s => s.isDone(formData)).length;
              const totalSubs = step.subtasks.length;
              const stepPct = Math.round((doneSubs / totalSubs) * 100);
              const hasBadData = step.id === 'reader_ready' && formData.preferred_reader === 'unsure' ||
                step.id === 'key_and_range_confirmed' && formData.originalKey === 'TBC';
              const dotColor = isChecked ? 'bg-emerald-500' :
                hasBadData ? 'bg-amber-500' :
                stepPct === 0 ? 'bg-red-500/40' :
                stepPct === 100 ? 'bg-amber-500' :
                'bg-indigo-500';
              const dotLabel = isChecked ? <Check className="w-4 h-4 md:w-5 md:h-5 text-white" /> :
                hasBadData ? <span className="text-[7px] md:text-[9px] font-black font-mono text-white">!</span> :
                stepPct === 0 ? <span className="text-[7px] md:text-[9px] font-black font-mono text-white/60">{i + 1}</span> :
                <span className="text-[7px] md:text-[9px] font-black font-mono text-white">{stepPct}%</span>;
              return (
                <React.Fragment key={step.id}>
                  {i > 0 && (
                    <motion.div
                      animate={{ backgroundColor: isChecked || (currentStepIndex > i) ? '#22c55e' : 'rgba(255,255,255,0.08)' }}
                      className="h-0.5 w-6 md:w-10 rounded-full transition-colors duration-500"
                    />
                  )}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowSummary(false);
                      setActiveView('summary');
                      setNavigateToStepId(step.id);
                    }}
                    className={cn(
                      "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0",
                      dotColor,
                      isCurrent ? "border-2 border-white/40" : "border-2 border-transparent"
                    )}
                  >
                    {dotLabel}
                  </motion.button>
                </React.Fragment>
              );
            })}
          </div>
        </DialogContent>
    </Dialog>
  );
};

export default ReadinessWizardModal;
