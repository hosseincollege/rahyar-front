'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { preferencesApi } from '@/lib/api/shared/preferences-api';

/** Persist the Rahcom backup menu's open state in the signed-in user's preferences. */
export function useBackupActionsPreference() {
  const [open, setOpen] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const versionAtStart = requestVersion.current;
    void preferencesApi.get().then((preferences) => {
      if (active && requestVersion.current === versionAtStart) {
        setOpen(preferences.rahcomBackupActionsOpen);
      }
    }).catch(() => {
      // Keep the menu closed when preferences cannot be loaded.
    });
    return () => { active = false; };
  }, []);

  const toggle = useCallback(() => {
    const next = !open;
    requestVersion.current += 1;
    setOpen(next);
    void preferencesApi.saveRahcomBackupActionsOpen(next).catch(() => {
      // Keep the current session responsive if persistence is temporarily unavailable.
    });
  }, [open]);

  return { open, toggle };
}
