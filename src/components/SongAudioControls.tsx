"use client";

import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Slider } from '@/components/ui/slider';
import { SetlistSong } from './SetlistManagementModal';
import { cn } from "@/lib/utils";
import { Volume2 } from 'lucide-react';
import { transposeKey } from '@/utils/keyUtils';

interface SongAudioControlsProps {