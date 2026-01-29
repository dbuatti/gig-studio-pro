"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManagementModal";
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

const cleanMetadata = (val: string | undefined | null) => {