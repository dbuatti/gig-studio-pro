"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Settings, ShieldCheck, Trash2, Edit3, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import GigSessionManager from './GigSessionManager';
import { SetlistSong } from './SetlistManagementModal';

interface SetlistSettingsModalProps {