"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Music, 
  FileText, 
  Download, 
  Apple, 
  Link2, 
  ExternalLink, 
  Printer, 
  ClipboardPaste, 
  Eye 
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManagementModal';
import { showSuccess } from '@/utils/toast';

interface LibraryEngineProps {