import type { CSSProperties, ReactNode } from 'react';

type RahcomMainWindowProps = {
  expanded: boolean;
  title: string;
  position: { top: number; left: number; maxWidth: number; maxHeight: number };
  bounds: { top: number; left: number; width: number; height: number };
  children: ReactNode;
};

/** Shared dialog surface and compact/full-window geometry for Rahcom row information. */
export function RahcomMainWindow({ expanded, title, position, bounds, children }: RahcomMainWindowProps) {
  const style: CSSProperties = expanded
    ? { position: 'fixed', top: bounds.top, left: bounds.left, width: bounds.width, maxWidth: bounds.width, height: bounds.height, maxHeight: bounds.height, overflowY: 'auto', backgroundColor: 'var(--background)', opacity: 1 }
    : { position: 'fixed', top: position.top, left: position.left, width: position.maxWidth, maxWidth: position.maxWidth, maxHeight: position.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 };

  return <section role="dialog" aria-modal="true" aria-label={title} style={style} className={expanded ? 'border-0 p-4 text-foreground shadow-none' : 'rounded-xl border border-border p-2 text-card-foreground shadow-2xl'}>{children}</section>;
}
