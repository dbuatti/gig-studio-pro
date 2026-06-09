"use client";

import React from "react";

export const DashboardSkeleton: React.FC = () => (
  <div className="min-h-screen bg-slate-950 animate-pulse">
    {/* Header */}
    <div className="h-14 md:h-[72px] bg-slate-900 border-b border-slate-800 flex items-center px-4 md:px-6" />
    
    {/* Stats Bar */}
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-slate-800 rounded-2xl" />
        ))}
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="h-10 bg-slate-800 rounded-xl w-48" />
        <div className="h-10 bg-slate-800 rounded-xl w-32" />
      </div>
      
      {/* Main Content */}
      <div className="h-96 bg-slate-800 rounded-2xl" />
    </div>
  </div>
);

export const PublicPageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-slate-950 animate-pulse">
    {/* Header */}
    <div className="px-6 py-10 md:py-20 text-center space-y-6">
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-800 mx-auto" />
      <div className="h-8 bg-slate-800 rounded-lg w-48 mx-auto" />
      <div className="h-4 bg-slate-800 rounded-lg w-64 mx-auto" />
    </div>
    
    {/* Content */}
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-16 bg-slate-800 rounded-xl" />
      ))}
    </div>
  </div>
);

export default DashboardSkeleton;
