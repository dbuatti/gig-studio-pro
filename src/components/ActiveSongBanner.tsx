"use client";

import React from 'react';
import { SetlistSong } from './SetlistManagementModal';
import { 
  Music, Youtube, Copy, Play, Pause, Activity, 
  Gauge, Sparkles, Tag, Apple, ExternalLink, 
  X, CloudDownload, AlertTriangle, Loader2, 
  FastForward, SkipBack, SkipForward 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';

interface ActiveSongBannerProps {