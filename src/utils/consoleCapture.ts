"use client";

export interface LogEntry {
  id: number;
  type: 'log' | 'warn' | 'error' | 'info';
  args: unknown[];
  timestamp: string;
}

let logs: LogEntry[] = [];
let idCounter = 0;
const MAX_LOGS = 500;
const listeners: Set<() => void> = new Set();

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
};

function capture(level: LogEntry['type'], args: unknown[]) {
  const entry: LogEntry = {
    id: ++idCounter,
    type: level,
    args,
    timestamp: new Date().toLocaleTimeString(),
  };
  logs = [...logs.slice(-MAX_LOGS + 1), entry];
  listeners.forEach(fn => fn());
}

export function initCapture() {
  console.log = (...args: unknown[]) => { originalConsole.log(...args); capture('log', args); };
  console.warn = (...args: unknown[]) => { originalConsole.warn(...args); capture('warn', args); };
  console.error = (...args: unknown[]) => { originalConsole.error(...args); capture('error', args); };
  console.info = (...args: unknown[]) => { originalConsole.info(...args); capture('info', args); };
}

export function restoreConsole() {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function clearLogs() {
  logs = [];
  listeners.forEach(fn => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
