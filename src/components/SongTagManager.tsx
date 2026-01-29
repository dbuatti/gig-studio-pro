"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Tag, X } from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';
import { showSuccess } from '@/utils/toast'; // Import showSuccess

interface SongTagManagerProps {