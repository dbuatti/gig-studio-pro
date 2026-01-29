"use client";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Music, FileText, Guitar, Sparkles, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManagementModal';

type ReaderType = 'ug' | 'ls' | 'fn' | null;

interface SheetMusicRecommenderProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onOpenInApp?: (app: string, url?: string) => void;
}

const SheetMusicRecommender: React.FC<SheetMusicRecommenderProps> = ({