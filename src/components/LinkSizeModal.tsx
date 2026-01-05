"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Ruler, X, Check } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import { showSuccess } from '@/utils/toast';

interface LinkSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LinkSizeModal: React.FC<LinkSizeModalProps> = ({ isOpen, onClose }) => {
  const { linkSize, setLinkSize } = useSettings();

  const handleSave = () => {
    showSuccess("Link size updated!");
    onClose();
  };

  const sizes: { value: 'small' | 'medium' | 'large' | 'extra-large'; label: string; dotSize: number }[] = [
    { value: 'small', label: 'Small', dotSize: 16 },
    { value: 'medium', label: 'Medium', dotSize: 24 },
    { value: 'large', label: 'Large', dotSize: 32 },
    { value: 'extra-large', label: 'X-Large', dotSize: 40 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-popover text-foreground border-border rounded-[2rem]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Ruler className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Link & Button Size</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Adjust the visual size of interactive elements on your sheet music.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Accessibility
            </Label>
            <ToggleGroup
              type="single"
              value={linkSize}
              onValueChange={(value) => value && setLinkSize(value as 'small' | 'medium' | 'large' | 'extra-large')}
              className="grid grid-cols-2 gap-3 bg-secondary p-3 rounded-2xl border border-border"
            >
              {sizes.map((size) => (
                <ToggleGroupItem
                  key={size.value}
                  value={size.value}
                  className={cn(
                    "h-20 flex flex-col items-center justify-center rounded-xl border transition-all",
                    linkSize === size.value
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg"
                      : "bg-card border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  <div
                    className="rounded-full bg-white/20 mb-2"
                    style={{ width: `${size.dotSize}px`, height: `${size.dotSize}px` }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest">{size.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-secondary">
          <Button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl">
            <Check className="w-4 h-4 mr-2" /> Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkSizeModal;