'use client';

import { useCallback, useState } from 'react';

/** Keep the backup menu state local to the current Rahcom page. */
export function useBackupActionsPreference() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  return { open, toggle };
}
