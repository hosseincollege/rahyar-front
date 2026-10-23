// src/lib/log-store.ts
'use client';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  time: string;
}

type Listener = (logs: LogEntry[]) => void;

let logs: LogEntry[] = [];
let seq = 0;

const listeners = new Set<Listener>();
const MAX_LOGS = 200;

function emit(): void {
  for (const listener of listeners) {
    listener(logs);
  }
}

export function subscribeLogs(listener: Listener): () => void {
  listeners.add(listener);
  listener(logs);

  return (): void => {
    listeners.delete(listener);
  };
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function addLog(level: LogLevel, message: string): void {
  logs = [
    ...logs.slice(-(MAX_LOGS - 1)),
    {
      id: ++seq,
      level,
      message,
      time: new Date().toLocaleTimeString('fa-IR'),
    },
  ];

  emit();
}

export function clearLogs(): void {
  logs = [];
  emit();
}
