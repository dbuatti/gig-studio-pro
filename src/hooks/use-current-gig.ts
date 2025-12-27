"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface CurrentGigState {
  currentGigId: string | null;
  currentGigName: string | null;
  setCurrentGig: (id: string, name: string) => void;
  clearCurrentGig: () => void;
  ensureGig: () => Promise<{ id: string; name: string } | null>;
  fetchCurrentGig: () => Promise<void>;
}

export const useCurrentGig = create<CurrentGigState>()(
  persist(
    (set, get) => ({
      currentGigId: null,
      currentGigName: null,
      
      setCurrentGig: (id: string, name: string) => {
        set({ currentGigId: id, currentGigName: name });
        showSuccess(`Active gig set to: ${name}`);
      },
      
      clearCurrentGig: () => {
        set({ currentGigId: null, currentGigName: null });
      },
      
      ensureGig: async () => {
        const { currentGigId, currentGigName } = get();
        
        if (currentGigId && currentGigName) {
          return { id: currentGigId, name: currentGigName };
        }
        
        // Try to fetch the most recent gig
        try {
          const { data, error } = await supabase
            .from('setlists')
            .select('id, name')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (error) throw error;
          
          if (data) {
            setCurrentGig(data.id, data.name);
            return { id: data.id, name: data.name };
          }
        } catch (err) {
          console.error("Failed to fetch recent gig:", err);
        }
        
        return null;
      },
      
      fetchCurrentGig: async () => {
        const { currentGigId } = get();
        if (!currentGigId) return;
        
        try {
          const { data, error } = await supabase
            .from('setlists')
            .select('name')
            .eq('id', currentGigId)
            .single();
            
          if (error) throw error;
          
          if (data) {
            set({ currentGigName: data.name });
          } else {
            // Gig was deleted
            set({ currentGigId: null, currentGigName: null });
          }
        } catch (err) {
          console.error("Failed to fetch current gig:", err);
        }
      }
    }),
    {
      name: 'current-gig-storage',
      partialize: (state) => ({ 
        currentGigId: state.currentGigId, 
        currentGigName: state.currentGigName 
      })
    }
  )
);