"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Play, Pause, SkipForward, SkipBack, X, Music, 
  Waves, Activity, ArrowRight, Shuffle,
  Settings2, Gauge, FileText, Save, Youtube,
  Monitor, AlignLeft, RotateCcw, ShieldCheck, ExternalLink,
  Clock, Timer, ChevronRight, Zap, Minus, Plus, Edit, Check, Keyboard, CloudDownload, AlertTriangle, Loader2
} from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import ShortcutLegend from './ShortcutLegend';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { useSettings } from '@/hooks/use-settings';

interface PerformanceOverlayProps {