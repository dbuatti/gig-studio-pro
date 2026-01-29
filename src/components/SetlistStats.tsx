"use client";

import React, { useState } from 'react';
import { SetlistSong } from './SetlistManagementModal';
import { Clock, Music, Target, PieChart, BarChart3, Download, Loader2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Input } from './ui/input';
import { Button } from './ui/button';
import { calculateReadiness } from '@/utils/repertoireSync';

interface SetlistStatsProps {