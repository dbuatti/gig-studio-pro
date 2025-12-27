"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ListPlus, AlertTriangle, Check, Loader2, ChevronDown, PlusCircle } from 'lucide-react';
import { useCurrentGig } from '@/hooks/use-current-gig';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { SetlistSong } from './SetlistManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from './AuthProvider';
import { cn } from '@/lib/utils';

interface AddToGigButtonProps {
  songData: Partial<SetlistSong>;
  onAdded?: (gigId: string) => void;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}

export const AddToGigButton: React.FC<AddToGigButtonProps> = ({ 
  songData, 
  onAdded, 
  className = "",
  size = 'default',
  variant = 'default'
}) => {
  const { user } = useAuth();
  const { currentGigId, currentGigName, setCurrentGig, ensureGig, fetchCurrentGig } = useCurrentGig();
  const [isAdding, setIsAdding] = useState(false);
  const [showGigSelector, setShowGigSelector] = useState(false);
  const [recentGigs, setRecentGigs] = useState<{ id: string; name: string }[]>([]);
  const [newGigName, setNewGigName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (showGigSelector) {
      fetchRecentGigs();
    }
  }, [showGigSelector]);

  const fetchRecentGigs = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select('id, name')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setRecentGigs(data || []);
    } catch (err) {
      console.error("Failed to fetch recent gigs:", err);
    }
  };

  const handleAddToGig = async () => {
    if (!songData.name || !songData.artist) {
      showError("Please complete song title and artist first");
      return;
    }

    setIsAdding(true);

    try {
      // Ensure we have a gig context
      let gigId = currentGigId;
      let gigName = currentGigName;

      if (!gigId) {
        const gig = await ensureGig();
        if (gig) {
          gigId = gig.id;
          gigName = gig.name;
        } else {
          // No gig exists, prompt to create one
          setShowGigSelector(true);
          setIsAdding(false);
          return;
        }
      }

      // Get the next order index for this gig
      const { data: existingItems, error: orderError } = await supabase
        .from('setlist_items')
        .select('order_index')
        .eq('gig_id', gigId)
        .order('order_index', { ascending: false })
        .limit(1);

      if (orderError) throw orderError;

      const nextOrderIndex = existingItems && existingItems.length > 0 
        ? (existingItems[0].order_index || 0) + 1 
        : 0;

      // Insert the song into the setlist
      const { error: insertError } = await supabase
        .from('setlist_items')
        .insert({
          gig_id: gigId,
          song_title: songData.name,
          song_artist: songData.artist,
          original_key: songData.originalKey,
          target_key: songData.targetKey,
          bpm: songData.bpm,
          duration_seconds: songData.duration_seconds,
          preview_url: songData.previewUrl,
          youtube_url: songData.youtubeUrl,
          ug_url: songData.ugUrl,
          pdf_url: songData.pdfUrl,
          lyrics: songData.lyrics,
          notes: songData.notes,
          user_tags: songData.user_tags,
          resources: songData.resources,
          order_index: nextOrderIndex,
          is_approved: songData.isApproved || false,
          readiness_score: songData.readiness_score || 0
        });

      if (insertError) throw insertError;

      showSuccess(`"${songData.name}" added to ${gigName}!`);
      if (onAdded) onAdded(gigId);
      
      // Close selector if it was open
      setShowGigSelector(false);
      setShowCreateDialog(false);

    } catch (err: any) {
      console.error("Add to gig error:", err);
      showError(`Failed to add song: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCreateGigAndAdd = async () => {
    if (!newGigName.trim()) {
      showError("Please enter a gig name");
      return;
    }

    if (!user) {
      showError("You must be logged in to create gigs");
      return;
    }

    setIsAdding(true);

    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert({
          user_id: user.id,
          name: newGigName.trim(),
          songs: [],
          time_goal: 7200
        })
        .select('id, name')
        .single();

      if (error) throw error;

      setCurrentGig(data.id, data.name);
      
      // Now add the song to this new gig
      await handleAddToGig();
      
    } catch (err) {
      showError("Failed to create gig");
      setIsAdding(false);
    }
  };

  const handleSelectGigAndAdd = async (gigId: string, gigName: string) => {
    setCurrentGig(gigId, gigName);
    // Wait a moment for state to update, then add
    setTimeout(() => handleAddToGig(), 100);
  };

  const isValidSong = !!songData.name && !!songData.artist;

  if (!isValidSong) {
    return (
      <Button 
        disabled 
        variant="outline" 
        className={cn("gap-2 opacity-50", className)}
        size={size}
      >
        <AlertTriangle className="w-4 h-4" />
        Complete Song Details
      </Button>
    );
  }

  return (
    <>
      {/* Main Add Button */}
      <Button
        onClick={handleAddToGig}
        disabled={isAdding}
        className={cn(
          "gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95",
          className
        )}
        size={size}
        variant={variant}
      >
        {isAdding ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : currentGigId ? (
          <Check className="w-4 h-4" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {isAdding ? "Adding..." : currentGigId ? `Add to ${currentGigName}` : "Add to Gig"}
      </Button>

      {/* Gig Selector Dialog */}
      <Dialog open={showGigSelector} onOpenChange={setShowGigSelector}>
        <DialogContent className="sm:max-w-md bg-slate-950 text-white border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              {currentGigId ? "Change Gig?" : "Select Gig"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {currentGigId 
                ? `Currently: ${currentGigName}. Select a different gig or create new.`
                : "No active gig found. Select an existing gig or create a new one."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Recent Gigs List */}
            {recentGigs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent Gigs</Label>
                <ScrollArea className="max-h-[200px] pr-2">
                  {recentGigs.map((gig) => (
                    <Button
                      key={gig.id}
                      variant="ghost"
                      className="w-full justify-start mb-1 h-12 rounded-xl hover:bg-white/10"
                      onClick={() => handleSelectGigAndAdd(gig.id, gig.name)}
                    >
                      <ListPlus className="w-4 h-4 mr-3 text-indigo-400" />
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-sm">{gig.name}</span>
                        <span className="text-[9px] text-slate-500 uppercase">Click to add song</span>
                      </div>
                    </Button>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Create New Gig */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Create New Gig</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Gig name (e.g., Friday Night)"
                  value={newGigName}
                  onChange={(e) => setNewGigName(e.target.value)}
                  className="flex-1 bg-white/5 border-white/10 h-11"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateGigAndAdd();
                  }}
                />
                <Button
                  onClick={handleCreateGigAndAdd}
                  disabled={!newGigName.trim() || isAdding}
                  className="h-11 px-4 bg-indigo-600 hover:bg-indigo-700"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setShowGigSelector(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};