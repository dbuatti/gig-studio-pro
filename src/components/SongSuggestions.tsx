"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, PlusCircle, CheckCircle2, Search, Library } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';

interface SongSuggestionsProps {
  repertoire: SetlistSong[];
  onSelectSuggestion: (query: string) => void;
}

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ repertoire, onSelectSuggestion }) => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState('entire_profile_vibe');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  const fetchSuggestions = useCallback(async () => {
    if (!user) {
      showError("Please log in to get suggestions.");
      return;
    }

    setLoading(true);
    setSuggestions([]); // Clear previous suggestions

    try {
      let prompt = '';
      let payload: any = { userId: user.id };

      if (searchMode === 'entire_profile_vibe') {
        prompt = 'Suggest songs based on my entire repertoire vibe.';
      } else if (searchMode === 'specific_genre' && selectedGenre) {
        prompt = `Suggest songs in the ${selectedGenre} genre.`;
        payload.genre = selectedGenre;
      } else if (searchMode === 'custom_prompt' && customPrompt) {
        prompt = customPrompt;
        payload.customPrompt = customPrompt;
      } else {
        showError("Please select a search mode or enter a custom prompt.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-song-suggestions', {
        body: payload,
      });

      if (error) throw error;

      if (data && data.suggestions) {
        setSuggestions(data.suggestions);
        showSuccess("Suggestions loaded!");
      } else {
        showError("No suggestions found.");
      }
    } catch (err: any) {
      console.error("[SongSuggestions] Error fetching suggestions:", err);
      showError(`Failed to fetch suggestions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, searchMode, selectedGenre, customPrompt]);

  useEffect(() => {
    // Fetch suggestions on component mount or when user changes
    if (user) {
      fetchSuggestions();
    }
  }, [user, fetchSuggestions]);

  const handleRefreshSuggestions = () => {
    fetchSuggestions();
  };

  const isSongInRepertoire = (suggestion: any) => {
    return repertoire.some(song => 
      song.name?.toLowerCase() === suggestion.name?.toLowerCase() && 
      song.artist?.toLowerCase() === suggestion.artist?.toLowerCase()
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> AI Discover Engine
        </h3>
        <Button 
          variant="link" 
          onClick={handleRefreshSuggestions} 
          className="text-indigo-600 text-[10px] font-bold uppercase tracking-widest h-auto p-0"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
          Refresh Suggestions
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="search-mode" className="text-[9px] font-bold text-slate-500 uppercase">Search Mode</label>
          <Select value={searchMode} onValueChange={setSearchMode}>
            <SelectTrigger id="search-mode" className="h-9 text-[10px] bg-white border-slate-100">
              <SelectValue placeholder="Select search mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entire_profile_vibe">Entire Profile Vibe</SelectItem>
              <SelectItem value="specific_genre">Specific Genre</SelectItem>
              <SelectItem value="custom_prompt">Custom Prompt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {searchMode === 'specific_genre' && (
          <div className="space-y-1.5">
            <label htmlFor="genre-select" className="text-[9px] font-bold text-slate-500 uppercase">Genre</label>
            <Input 
              id="genre-select"
              placeholder="e.g., Pop, Rock, Jazz" 
              className="h-9 text-[10px] bg-white border-slate-100" 
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
            />
          </div>
        )}

        {searchMode === 'custom_prompt' && (
          <div className="space-y-1.5">
            <label htmlFor="custom-prompt" className="text-[9px] font-bold text-slate-500 uppercase">Custom Prompt</label>
            <Input 
              id="custom-prompt"
              placeholder="e.g., Upbeat songs for a wedding" 
              className="h-9 text-[10px] bg-white border-slate-100" 
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Generating suggestions...
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">No suggestions yet. Try refreshing or changing your search mode.</p>
        ) : (
          suggestions.map((suggestion, index) => (
            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex-1 min-w-0 mb-3 sm:mb-0 sm:pr-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{suggestion.name}</h4>
                <p className="text-xs text-indigo-600 font-medium truncate">{suggestion.artist}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{suggestion.description}</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {isSongInRepertoire(suggestion) ? (
                  <span className="flex items-center gap-1 text-green-600 text-[9px] font-bold uppercase">
                    <CheckCircle2 className="w-3 h-3" /> In Library
                  </span>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onSelectSuggestion(suggestion.name + " " + suggestion.artist)}
                    className="h-8 px-3 text-[9px] uppercase font-bold gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Search className="w-3 h-3" /> Search & Add
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SongSuggestions;