"use client";

import React, { useState, useMemo } from 'react';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Music, Hash, ArrowRight, Loader2, Search } from 'lucide-react';
import SearchHighlight from './SearchHighlight';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { ScrollArea } from './ui/scroll-area';

interface KeyManagementMatrixProps {
  repertoire: SetlistSong[];
  onUpdateKey: (songId: string, updates: { originalKey?: string | null, targetKey?: string | null, pitch?: number }) => Promise<void>;
  keyPreference: KeyPreference;
}

const KeyManagementMatrix: React.FC<KeyManagementMatrixProps> = ({
  repertoire,
  onUpdateKey,
  keyPreference,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  const filteredRepertoire = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return repertoire.filter(song => 
      song.name.toLowerCase().includes(q) || 
      song.artist?.toLowerCase().includes(q)
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [repertoire, searchTerm]);

  const keysToUse = keyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  const handleStageKeyChange = async (song: SetlistSong, newTargetKey: string) => {
    if (isUpdatingId) return;
    setIsUpdatingId(song.id);
    
    const originalKey = song.originalKey || 'C';
    const newPitch = calculateSemitones(originalKey, newTargetKey);
    
    try {
      await onUpdateKey(song.id, { 
        targetKey: newTargetKey, 
        pitch: newPitch 
      });
      showSuccess(`Stage Key for ${song.name} updated to ${newTargetKey}`);
    } catch (e) {
      showError(`Failed to update key for ${song.name}`);
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleOriginalKeyChange = async (song: SetlistSong, newOriginalKey: string) => {
    if (isUpdatingId) return;
    setIsUpdatingId(song.id);
    
    const currentTargetKey = song.targetKey || song.originalKey || 'C';
    const newPitch = calculateSemitones(newOriginalKey, currentTargetKey);
    
    try {
      await onUpdateKey(song.id, { 
        originalKey: newOriginalKey, 
        pitch: newPitch 
      });
      showSuccess(`Original Key for ${song.name} updated to ${newOriginalKey}`);
    } catch (e) {
      showError(`Failed to update original key for ${song.name}`);
    } finally {
      setIsUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search songs..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-12 pl-12 bg-card border-border rounded-xl text-foreground"
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <ScrollArea className="h-[60vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary z-10">
              <TableRow>
                <TableHead className="w-[40%] text-[10px] font-black uppercase tracking-widest">Song</TableHead>
                <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-widest text-center">Original Key</TableHead>
                <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-widest text-center">Transpose</TableHead>
                <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-widest text-center">Stage Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepertoire.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No songs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRepertoire.map(song => {
                  const originalKey = song.originalKey || 'TBC';
                  const targetKey = song.targetKey || originalKey;
                  const displayOrigKey = formatKey(originalKey, keyPreference);
                  const displayTargetKey = formatKey(targetKey, keyPreference);
                  const isUpdating = isUpdatingId === song.id;

                  return (
                    <TableRow key={song.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium py-3">
                        <div className="flex flex-col">
                          <SearchHighlight text={song.name} query={searchTerm} className="text-sm font-bold text-foreground truncate" />
                          <SearchHighlight text={song.artist || "Unknown Artist"} query={searchTerm} className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest" />
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          {originalKey === 'TBC' ? (
                            <Select 
                              value={originalKey} 
                              onValueChange={(val) => handleOriginalKeyChange(song, val)}
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="h-8 w-24 bg-secondary border-border text-xs font-mono font-bold text-destructive">
                                <SelectValue placeholder="TBC" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border text-foreground z-[300]">
                                <SelectItem value="TBC" disabled className="font-mono">TBC</SelectItem>
                                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm font-mono font-bold text-foreground">{displayOrigKey}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-500">
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : `${song.pitch > 0 ? '+' : ''}${song.pitch || 0} ST`}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Select 
                          value={displayTargetKey} 
                          onValueChange={(val) => handleStageKeyChange(song, val)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="h-8 w-24 bg-indigo-600/10 border-indigo-500/20 text-xs font-mono font-bold text-indigo-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border text-foreground z-[300]">
                            {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
};

export default KeyManagementMatrix;