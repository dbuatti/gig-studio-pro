"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, AlertCircle, ListPlus, Music, Loader2, Check, AlertTriangle } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

interface BatchImportRepertoireProps {
  userId: string;
  onComplete: () => void;
}

interface ImportResult {
  added: number;
  skipped: number;
  errors: number;
}

const NOISE_WORDS = [
  "welcome back", "gig studio", "professional", "storage", "system tools",
  "repertoire", "stage readiness", "library health", "action required",
  "missing data", "total repertoire", "active tracks", "daily performance",
  "live performance", "lyrics transcribed", "chords mapped", "ug links",
  "pdfs attached", "range analyzed", "original keys", "stage keys",
  "repertoire discovery", "ai-curved", "automation hub", "bulk vibe",
  "smart-link", "queue audio", "retry failed", "no tracks found",
  "try adjusting", "clear all", "songs detected", "auto-metadata",
  "song list", "paste a", "golden age", "classic stage", "piano bar",
  "crowd-pleasers", "sing-along", "opening hour", "escalation tools",
  "room-stopper", "foolproof", "closers",
];

const isLikelySong = (title: string, artist: string): boolean => {
  if (title.length < 2 || title.length > 120) return false;
  if (artist.length > 80) return false;
  if (/^\d+%$/.test(title)) return false;
  if (/^\d+\/\d+$/.test(title)) return false;
  if (/^https?:\/\//.test(title)) return false;
  if (/^\d+$/.test(title)) return false;
  if (title.startsWith('- ') && title.length < 15) return false;
  if (/^\*\*/.test(title)) return false;
  const lower = title.toLowerCase();
  if (NOISE_WORDS.some(w => lower.includes(w))) return false;
  return true;
};

const parseBatchText = (content: string): { title: string; artist: string }[] => {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const songs: { title: string; artist: string }[] = [];

  lines.forEach(line => {
    let title = "";
    let artist = "Unknown Artist";

    if (line.includes('|') && !line.includes('---') && !line.includes('Song Title')) {
      const columns = line.split('|').map(c => c.trim()).filter(c => c !== "");
      if (columns.length >= 2) {
        const startIdx = /^\d+$/.test(columns[0]) ? 1 : 0;
        title = columns[startIdx].replace(/\*\*/g, '');
        artist = columns[startIdx + 1]?.replace(/\*\*/g, '') || "Unknown Artist";
      }
    } else if (line.includes(' — ')) {
      const parts = line.split(' — ').map(p => p.trim());
      title = parts[0].replace(/^\d+[.)\-\s]+/, '');
      artist = parts[1] || "Unknown Artist";
    } else if (line.includes(' - ')) {
      const parts = line.split(' - ').map(p => p.trim());
      artist = parts[0].replace(/^\d+[.)\-\s]+/, '');
      title = parts[1];
    } else if (line.toLowerCase().includes(' by ')) {
      const parts = line.split(/ by /i).map(p => p.trim());
      title = parts[0].replace(/^\d+[.)\-\s]+/, '');
      artist = parts[1];
    } else {
      title = line.replace(/^\d+[.)\-\s]+/, '');
    }

    title = title.replace(/^["']|["']$/g, '').replace(/—.*$/, '').trim();
    artist = artist.replace(/^["']|["']$/g, '').trim();

    if (title && isLikelySong(title, artist)) {
      songs.push({ title, artist });
    }
  });

  return songs;
};

const BatchImportRepertoire: React.FC<BatchImportRepertoireProps> = ({ userId, onComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<{ title: string; artist: string }[]>([]);

  const handlePreview = () => {
    const parsed = parseBatchText(text);
    setPreview(parsed);
  };

  const handleImport = async () => {
    const songs = preview.length > 0 ? preview : parseBatchText(text);
    if (songs.length === 0) return;

    setIsImporting(true);
    setResult(null);

    const songsToSync: Partial<SetlistSong>[] = songs.map(s => ({
      name: s.title,
      artist: s.artist,
      originalKey: "TBC",
      targetKey: "TBC",
      pitch: 0,
      previewUrl: "",
      isSyncing: true,
      isMetadataConfirmed: false,
      isKeyConfirmed: false,
      resources: [],
      user_tags: [],
      is_pitch_linked: true,
      isApproved: false,
      preferred_reader: null,
      ug_chords_config: DEFAULT_UG_CHORDS_CONFIG,
      is_ug_chords_present: false,
      highest_note_original: null,
      sync_status: 'IDLE',
      last_sync_log: null,
      auto_synced: false,
      is_sheet_verified: false,
      extraction_status: 'idle',
    }));

    try {
      const synced = await syncToMasterRepertoire(userId, songsToSync);
      setResult({
        added: synced.length,
        skipped: songs.length - synced.length,
        errors: 0,
      });
      onComplete();
    } catch (err) {
      console.error('[BatchImport] Error:', err);
      setResult({ added: 0, skipped: 0, errors: songs.length });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setText("");
    setPreview([]);
    setResult(null);
  };

  const parsedCount = text.trim() ? parseBatchText(text).length : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold uppercase tracking-tight shadow-sm hover:shadow-md transition-all">
          <ClipboardPaste className="w-4 h-4" /> Batch Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-popover border-none shadow-2xl rounded-[2rem] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="bg-indigo-600 p-8 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ListPlus className="w-8 h-8" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Batch Repertoire Import</DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium">Paste a list of songs to add directly to your master repertoire.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-8 space-y-6 overflow-y-auto flex-1 min-h-0">
          {result ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-6 text-center space-y-3">
                {result.errors === 0 ? (
                  <Check className="w-12 h-12 text-emerald-500 mx-auto" />
                ) : (
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                )}
                <h3 className="text-lg font-black uppercase tracking-tight text-emerald-900 dark:text-emerald-300">Import Complete</h3>
                <div className="flex justify-center gap-8 text-sm font-bold">
                  <div>
                    <span className="text-2xl font-black text-emerald-600">{result.added}</span>
                    <p className="text-emerald-700/70 dark:text-emerald-400/70 text-[10px] uppercase tracking-widest mt-1">Added</p>
                  </div>
                  {result.skipped > 0 && (
                    <div>
                      <span className="text-2xl font-black text-slate-500">{result.skipped}</span>
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">Skipped</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60 mt-2">
                  The AI background worker will now verify metadata and link reference audio.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                <div className="bg-emerald-100 dark:bg-emerald-600/10 p-2.5 rounded-xl">
                  <Music className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Auto-Metadata</Label>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">AI will enrich after import</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Song List</Label>
                  <span className="text-[10px] font-black text-indigo-500 uppercase">
                    {parsedCount > 0 ? `${parsedCount} songs detected` : "Use 'Artist — Title' or numbered list"}
                  </span>
                </div>
                <Textarea 
                  placeholder={"1. Fly Me to the Moon — Sinatra\n2. The Way You Look Tonight — Jerome Kern\n3. Cheek to Cheek — Irving Berlin\n\nOr paste a numbered list, markdown table, etc."}
                  className="min-h-[200px] max-h-[40vh] font-mono text-sm bg-card border-border focus-visible:ring-indigo-500 rounded-2xl p-6 shadow-inner resize-none text-foreground"
                  value={text}
                  onChange={(e) => { setText(e.target.value); setPreview([]); setResult(null); }}
                />
              </div>

              {preview.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5 max-h-[30vh] overflow-y-auto space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Preview — {preview.length} songs</Label>
                  {preview.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{i + 1}.</span>
                      <span className="text-sm font-bold truncate">{s.title}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">— {s.artist}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-4 p-5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                <AlertCircle className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-tight">Heads Up</p>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-1 leading-relaxed text-left">
                    Songs will be added with "TBC" keys. The AI worker will auto-detect keys, BPM, and genre, then link YouTube reference audio.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-8 bg-secondary border-t border-border flex flex-col sm:flex-row gap-4">
          <Button variant="ghost" onClick={handleClose} className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl text-foreground hover:bg-accent dark:hover:bg-secondary">
            {result ? 'Close' : 'Discard'}
          </Button>
          {!result && (
            <>
              {!preview.length && parsedCount > 0 && (
                <Button 
                  onClick={handlePreview}
                  variant="outline"
                  className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl border-indigo-200 text-indigo-600"
                  disabled={isImporting}
                >
                  Preview ({parsedCount} songs)
                </Button>
              )}
              <Button 
                onClick={handleImport} 
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-xs h-12 rounded-xl shadow-xl shadow-indigo-500/20 gap-3"
                disabled={!text.trim() || isImporting}
              >
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  <><ListPlus className="w-4 h-4" /> {preview.length > 0 ? `Deploy ${preview.length} Songs` : 'Deploy to Repertoire'}</>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchImportRepertoire;
