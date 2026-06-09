"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
  </div>
);

export const PageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-slate-950 animate-pulse">
    <div className="h-16 bg-slate-900 border-b border-slate-800" />
    <div className="p-6 space-y-6">
      <div className="h-8 bg-slate-800 rounded-lg w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-slate-800 rounded-2xl" />
        <div className="h-32 bg-slate-800 rounded-2xl" />
        <div className="h-32 bg-slate-800 rounded-2xl" />
      </div>
      <div className="h-64 bg-slate-800 rounded-2xl" />
    </div>
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="text-center space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Chart...</p>
    </div>
  </div>
);

export default LoadingSpinner;
