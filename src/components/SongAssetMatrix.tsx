"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import { RESOURCE_TYPES } from '@/utils/constants';
import { SetlistSong } from './SetlistManagementModal';

interface SongAssetMatrixProps {