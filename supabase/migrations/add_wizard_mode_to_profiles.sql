-- Add wizard_mode column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wizard_mode BOOLEAN DEFAULT FALSE;
