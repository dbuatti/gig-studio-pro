"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLogs, clearLogs, subscribe, type LogEntry } from '@/utils/consoleCapture';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const LOG_LEVELS: Record<LogEntry['type'], string> = {
  log: 'text-slate-300',
  warn: 'text-amber-400',
  error: 'text-red-400',
  info: 'text-blue-400',
};

export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogEntry['type'] | 'all'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs(getLogs());
    return subscribe(() => setLogs([...getLogs()]));
  }, []);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isOpen]);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  const formatArg = (arg: unknown): string => {
    if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[999] w-[500px] max-h-[400px] bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Console</span>
          <span className="text-[9px] text-slate-600 font-mono">{logs.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'error', 'warn', 'info', 'log'] as const).map(l => (
            <button key={l} onClick={() => setFilter(l)}
              className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors",
                filter === l ? "bg-indigo-600/20 text-indigo-400" : "text-slate-600 hover:text-slate-400"
              )}>
              {l === 'all' ? 'All' : l}
            </button>
          ))}
          <button onClick={clearLogs} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] leading-relaxed space-y-0.5 custom-scrollbar">
        {filtered.length === 0 && (
          <div className="text-slate-600 text-center py-8 text-[9px]">No logs captured.</div>
        )}
        {filtered.map(entry => (
          <div key={entry.id}>
            <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className="w-full flex items-start gap-2 text-left p-1 rounded hover:bg-white/5 transition-colors">
              <span className="text-[8px] text-slate-600 shrink-0 mt-0.5 font-mono">{entry.timestamp}</span>
              <span className={cn("shrink-0 text-[8px] font-black uppercase", LOG_LEVELS[entry.type])}>
                {entry.type === 'error' ? 'ERR' : entry.type === 'warn' ? 'WRN' : entry.type === 'info' ? 'INF' : 'LOG'}
              </span>
              <span className="text-slate-400 truncate flex-1 min-w-0">
                {entry.args.map(a => formatArg(a)).join(' ')}
              </span>
              <ChevronDown className={cn("w-2.5 h-2.5 text-slate-600 shrink-0 mt-0.5 transition-transform",
                expandedId === entry.id && "rotate-180")} />
            </button>
            {expandedId === entry.id && (
              <div className="ml-8 p-2 bg-slate-900/50 rounded border border-white/5 mb-1 overflow-x-auto">
                {entry.args.map((arg, i) => (
                  <pre key={i} className="text-[9px] text-slate-400 whitespace-pre-wrap break-all">{formatArg(arg)}</pre>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
