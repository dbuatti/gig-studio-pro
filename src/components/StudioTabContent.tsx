"use client";
import React from 'react';
import { SetlistSong } from './SetlistManagementModal';
import { AudioEngineControls } from '@/hooks/use-tone-audio';
import SongDetailsTab from './SongDetailsTab';
import SongChartsTab from './SongChartsTab';
import LyricsEngine from './LyricsEngine';
import LibraryEngine from './LibraryEngine';
import SongConfigTab from './SongConfigTab';
import SongAudioPlaybackTab from './SongAudioPlaybackTab';
import YoutubeMediaManager from './YoutubeMediaManager';
import { transposeKey } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { Youtube } from 'lucide-react';
import { KeyPreference } from '@/hooks/use-settings';

interface StudioTabContentProps {