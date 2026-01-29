"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, AlertCircle, ListPlus, Youtube, Wand2, Music } from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';

interface ImportSetlistProps {