'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, X } from 'lucide-react';
import { uiMessage } from '@/lib/ui-messages';
import type { Locale } from '@/lib/languages';

export function RahcomCopyPreview({ open, title, text, locale, onClose }: { open: boolean; title: string; text: string; locale: Locale; onClose: () => void }) {
  const [status, setStatus] = useState<'copied' | 'failed' | null>(null);
  const close = useCallback(() => { setStatus(null); onClose(); }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);
  if (!open || typeof document === 'undefined') return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };
  return createPortal(<div className="fixed inset-0 z-[1100] flex items-center justify-center bg-transparent p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} style={{ backgroundColor: 'var(--card)', opacity: 1 }} className="flex max-h-[min(82vh,42rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border text-card-foreground shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={close} aria-label={uiMessage(locale, 'rahcomCloseHistory')} title={uiMessage(locale, 'rahcomCloseHistory')} className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-foreground hover:border-primary"><X size={17}/></button>
      </header>
      <pre dir="auto" className="min-h-24 flex-1 overflow-auto whitespace-pre-wrap break-words bg-background p-4 text-sm leading-7 text-foreground">{text}</pre>
      {status && <p role={status === 'failed' ? 'alert' : 'status'} className={`px-4 pt-3 text-sm ${status === 'failed' ? 'text-destructive' : 'text-primary'}`}>{uiMessage(locale, status === 'copied' ? 'rahcomCopied' : 'rahcomCopyFailed')}</p>}
      <footer className="flex shrink-0 justify-end border-t border-border px-4 py-3">
        <button type="button" onClick={() => void copy()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><span>{status === 'copied' ? <Check size={16}/> : <Copy size={16}/>}</span><span>{uiMessage(locale, status === 'copied' ? 'rahcomCopied' : 'rahcomCopy')}</span></button>
      </footer>
    </section>
  </div>, document.body);
}
