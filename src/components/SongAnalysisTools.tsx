"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SetlistSong } from './SetlistManagementModal';
import { cn } from "@/lib/utils";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/use-settings';
import { formatKey } from '@/utils/keyUtils';
import {
  Loader2, Disc, SearchCode, Cloud
} from 'lucide-react';
import { analyze } from 'web-audio-beat-detector';

interface SongAnalysisToolsProps {