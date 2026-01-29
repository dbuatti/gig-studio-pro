"use client";

import React from 'react';
import { SetlistSong, Setlist } from './SetlistManagementModal';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Play, Pause, Music, Hash, Activity, Loader2, Check, ArrowLeft, Globe, ListMusic, Edit3, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import SetlistMultiSelector from './SetlistMultiSelector';

interface SongStudioConsolidatedHeaderProps {