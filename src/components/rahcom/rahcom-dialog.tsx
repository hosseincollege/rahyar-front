'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function RahcomDialog({ open, title, onClose, children, width = 'max-w-3xl' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className={`relative z-[101] max-h-[min(88vh,56rem)] w-full ${width} overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5`}>
      <header className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3"><h2 className="font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="بستن" title="بستن" className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><X size={16}/></button></header>
      {children}
    </section>
  </div>;
}
