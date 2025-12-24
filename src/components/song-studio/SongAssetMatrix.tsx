"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import { RESOURCE_TYPES } from '@/utils/constants';
import { SetlistSong } from '../SetlistManager';

interface SongAssetMatrixProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
}

const SongAssetMatrix: React.FC<SongAssetMatrixProps> = ({ formData, handleAutoSave }) => {
  const toggleResource = (id: string) => {
    const current = formData.resources || [];
    const updated = current.includes(id) ? current.filter(rid => rid !== id) : [...current, id];
    handleAutoSave({ resources: updated });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Asset Matrix</h3>
      <div className="grid grid-cols-1 gap-2.5">
        {RESOURCE_TYPES.map(res => {
          const isActive = formData.resources?.includes(res.id) ||
                         (res.id === 'UG' && formData.ugUrl) ||
                         (res.id === 'LYRICS' && formData.lyrics) ||
                         (res.id === 'LEAD' && formData.leadsheetUrl);
          return (
            <button
              key={res.id}
              onClick={() => toggleResource(res.id)}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all text-left group",
                isActive
                  ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                  : "bg-white/5 text-slate-500 border-white/5 hover:border-white/10"
              )}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{res.label}</span>
              {isActive ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30 group-hover:opacity-100" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SongAssetMatrix;