"use client";

import React, { useState } from 'react';
import { analyze } from 'web-audio-beat-detector';
import { Music, Play, Pause, RotateCcw, Loader2, CloudDownload, AlertTriangle } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

import AudioVisualizer from './AudioVisualizer';
import SongAnalysisTools from './SongAnalysisTools';
import SongAudioControls from './SongAudioControls';
import { SetlistSong } from './SetlistManagementModal';
import { AudioEngineControls } from '@/hooks/use-tone-audio';

interface SongAudioPlaybackTabProps {