"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetLink } from '@/types/sheet-music';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import { Link2, Save, X } from 'lucide-react';

interface LinkEditorOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  chartUrl: string;
  onLinkCreated: () => void;
  editingLink?: SheetLink | null;
}

const LinkEditorOverlay: React.FC<LinkEditorOverlayProps> = ({
  isOpen,
  onClose,
  songId,
  chartUrl,
  onLinkCreated,
  editingLink
}) => {
  const { user } = useAuth();
  const [targetPage, setTargetPage] = useState(editingLink?.target_page || 1);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const linkData = {
        song_id: songId,
        user_id: user.id,
        source_page: 1, // Simplified for now
        source_x: 50,
        source_y: 50,
        target_page: targetPage,
        target_x: 50,
        target_y: 50,
        link_size: 'medium' as const
      };

      if (editingLink) {
        const { error } = await supabase.from('sheet_links').update(linkData).eq('id', editingLink.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sheet_links').insert(linkData);
        if (error) throw error;
      }

      showSuccess("Link saved successfully");
      onLinkCreated();
      onClose();
    } catch (err: any) {
      showError("Failed to save link");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-popover border-border rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
            <Link2 className="w-5 h-5 text-indigo-500" />
            {editingLink ? "Edit Link" : "Create Link"}
          </DialogTitle>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Page</Label>
            <Input 
              type="number" 
              value={targetPage} 
              onChange={(e) => setTargetPage(parseInt(e.target.value) || 1)}
              className="h-12 bg-secondary border-border rounded-xl font-bold"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-black uppercase text-[10px]">Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black uppercase text-[10px] gap-2">
            <Save className="w-4 h-4" /> Save Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkEditorOverlay;