"use client";
import React, { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManagementModal';
import { ExternalLink, ShieldCheck, Printer, FileText, Music, Guitar, Search, Maximize, Minimize, Eye } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import UGChordsEditor from './UGChordsEditor';
import UGChordsReader from './UGChordsReader';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { KeyPreference } from '@/hooks/use-settings';

interface SongChartsTabProps {