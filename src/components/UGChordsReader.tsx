"use client";

import React, { useMemo, useRef, useEffect } from 'react';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { UGChordsConfig, SetlistSong } from './SetlistManagementModal';
import { transposeChords, calculateSemitones } from '@/utils/chordUtils';
import { cn } from "@/lib/utils";

interface UGChordsReaderProps {