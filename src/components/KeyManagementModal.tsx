"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Music, X, Hash } from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';
import { KeyPreference } from '@/hooks/use-settings';
import KeyManagementMatrix from './KeyManagementMatrix';

interface KeyManagementModalProps {