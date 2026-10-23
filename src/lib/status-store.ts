//frontend/src/lib/status-store.ts

"use client";

import { create } from "zustand"; // اگر zustand ندارید، نسخه Context پایین را بگویید

export type StatusLevel = "ok" | "warning" | "error" | "idle";

export interface ApiLogEntry {
  id: string;
  time: string;
  method: string;
  url: string;
  status: number | null;
  level: StatusLevel;
  message: string;
}

interface StatusState {
  level: StatusLevel;
  lastMessage: string;
  logs: ApiLogEntry[];
  pushLog: (entry: Omit<ApiLogEntry, "id" | "time">) => void;
  clear: () => void;
}

export const useStatusStore = create<StatusState>((set) => ({
  level: "idle",
  lastMessage: "آماده",
  logs: [],
  pushLog: (entry) =>
    set((s) => {
      const logs = [
        {
          ...entry,
          id: crypto.randomUUID(),
          time: new Date().toLocaleTimeString("fa-IR"),
        },
        ...s.logs,
      ].slice(0, 100);
      const level: StatusLevel =
        entry.level === "error" ? "error" : s.level === "error" ? "error" : entry.level;
      return { logs, level, lastMessage: entry.message };
    }),
  clear: () => set({ level: "idle", lastMessage: "آماده", logs: [] }),
}));

/** نگاشت کد HTTP به سطح وضعیت */
export function levelFromStatus(status: number | null): StatusLevel {
  if (status == null) return "error";
  if (status < 300) return "ok";
  if (status === 404 || status === 422) return "warning";
  return "error"; // 401, 403, 500, 503
}
