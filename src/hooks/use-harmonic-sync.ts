"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SetlistSong } from '@/components/SetlistManagementModal';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { KeyPreference } from './use-settings';

interface UseHarmonicSyncProps {