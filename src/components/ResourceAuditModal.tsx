"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  ExternalLink, 
  Search, 
  ShieldCheck,
  X,
  Music,
  Edit2,
  RotateCcw,
  Link2,
  SearchCode,
  FileX2,
  FileCheck2,
  Link2Off,
  ClipboardPaste,
  AlertTriangle,
  AlertCircle, 
  FileText,
  Guitar,
  Check,
  Sparkles,
  Loader2
} from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';
import { cn } from '@/lib/utils';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { isChordLine, transposeChords, extractKeyFromChords } from '@/utils/chordUtils';
import { calculateSemitones, formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';

interface ResourceAuditModalProps {