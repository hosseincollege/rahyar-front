'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Check, ClipboardCopy, Info, X } from 'lucide-react';

export type RahcomInfoField = { label: string; value: string };
type PopupPosition = { top: number; left: number; maxWidth: number; maxHeight: number };
type RowInfoPopup = { title: string; systemCode: string; fields: RahcomInfoField[]; position: PopupPosition; trigger: HTMLButtonElement };

export function openRahcomRowInfo(title: string, fields: RahcomInfoField[], trigger?: HTMLElement | null, point?: { x: number; y: number }, systemCode = '') {
  const resolvedCode = systemCode || fields.find((field) => /system\s*code|کد\s*(?:سامانه|ایستگاه)/i.test(field.label))?.value || '';
  const resolvedTitle = fields.find((field) => /system\s*name|systemname|نام\s*(?:سامانه|ایستگاه)|nome.*sistema|nom.*système|nombre.*sistema|назван.*систем|系统名称|システム名|اسم النظام/i.test(field.label) && field.value.trim())?.value || title;
  const systemFields = fields.filter((field) => field.value.trim() !== '' && field.value !== resolvedCode && field.value !== resolvedTitle && /axis|محور|استان|province|província|provincia|провинц|محافظة|المحافظ|ولاية|จังหวัด|省/i.test(field.label));
  const bounds = trigger?.closest('main')?.getBoundingClientRect() ?? document.querySelector('main')?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const rect = trigger?.getBoundingClientRect();
  const maxWidth = Math.max(240, Math.min(340, bounds.width - 24));
  const maxHeight = Math.max(160, Math.min(window.innerHeight * 0.8, 440, bounds.height - 24));
  const pointX = point?.x ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
  const pointY = point?.y ?? (rect ? rect.bottom : window.innerHeight / 2);
  const left = Math.max(bounds.left + 12, Math.min(pointX + 12, bounds.right - maxWidth - 12));
  const top = Math.max(bounds.top + 12, Math.min(pointY + 8, bounds.bottom - maxHeight - 12));
  const popupTrigger = (trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : document.createElement('button'))) as HTMLButtonElement;
  document.querySelector<HTMLButtonElement>('[data-rahcom-info-trigger][aria-expanded="true"]')?.setAttribute('aria-expanded', 'false');
  popupTrigger.setAttribute('data-rahcom-info-trigger', '');
  popupTrigger.setAttribute('aria-expanded', 'true');
  window.dispatchEvent(new CustomEvent<RowInfoPopup>('rahyar:row-info-open', { detail: { title: resolvedTitle, systemCode: resolvedCode, fields: systemFields, position: { top, left, maxWidth, maxHeight }, trigger: popupTrigger } }));
}

export function RahcomInfoHeader() {
  return <span role="img" aria-label="Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ø±Ø¯ÛŒÙ" className="inline-grid size-5 place-items-center text-muted-foreground"><Info size={15} /></span>;
}

export function RahcomRowInfo({ title, systemCode = '', fields }: { title: string; systemCode?: string; fields: RahcomInfoField[] }) {
  return <button type="button" aria-label={`Ø§Ø·Ù„Ø§Ø¹Ø§Øª ${title}`} title={`Ø§Ø·Ù„Ø§Ø¹Ø§Øª ${title}`} aria-haspopup="dialog" aria-expanded="false" onClick={(event) => {
      event.stopPropagation();
      openRahcomRowInfo(title, fields, event.currentTarget, { x: event.clientX, y: event.clientY }, systemCode);
    }} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary aria-expanded:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-rahcom-info-trigger><Info size={16} /></button>;
}

export function RahcomRowInfoHost() {
  const [popup, setPopup] = useState<RowInfoPopup | null>(null);
  const [copied, setCopied] = useState(false);
  const activeTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const openPopup = (event: Event) => {
      const nextPopup = (event as CustomEvent<RowInfoPopup>).detail;
      activeTrigger.current = nextPopup.trigger;
      setCopied(false);
      flushSync(() => setPopup(nextPopup));
    };
    window.addEventListener('rahyar:row-info-open', openPopup);
    return () => window.removeEventListener('rahyar:row-info-open', openPopup);
  }, []);
  useEffect(() => {
    if (!popup) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { activeTrigger.current = null; popup.trigger.setAttribute('aria-expanded', 'false'); setPopup(null); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [popup]);
  const close = () => {
    activeTrigger.current = null;
    popup?.trigger.setAttribute('aria-expanded', 'false');
    flushSync(() => setPopup(null));
  };
  if (!popup || typeof document === 'undefined') return null;
  const visibleFields = popup.fields.filter((field) => field.value.trim() !== '');
  const copyAll = async () => {
    await navigator.clipboard.writeText(`${popup.systemCode ? `${popup.systemCode}\n` : ''}${popup.title}\n${visibleFields.map((field) => `${field.label}: ${field.value}`).join('\n')}`);
    setCopied(true);
  };
  return createPortal(<div className="fixed inset-0 z-[1000] bg-transparent" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-label={popup.title} style={{ position: 'fixed', top: popup.position.top, left: popup.position.left, width: popup.position.maxWidth, maxWidth: popup.position.maxWidth, maxHeight: popup.position.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 }} className="rounded-xl border border-border p-2 text-card-foreground shadow-2xl">
      <div className="rahcom-system-popup">
        <header className="rahcom-popup-header"><div className="rahcom-popup-heading"><span className="rahcom-popup-code"><strong className="rahcom-popup-subtitle" dir="ltr">{popup.systemCode}</strong></span><strong className="rahcom-popup-title">{popup.title}</strong></div></header>
        <div className="rahcom-popup-data" dir="auto">{visibleFields.map((field, index) => <div key={`${field.label}:${index}`} className="rahcom-popup-row"><span>{field.label}</span><b className="whitespace-pre-wrap">{field.value}</b></div>)}</div>
        <div className="rahcom-popup-actions"><button type="button" className="danger" onClick={close} aria-label={'\u0628\u0633\u062a\u0646'} title={'\u0628\u0633\u062a\u0646'}><X size={16} /></button><button type="button" onClick={() => void copyAll()} aria-label={'\u06a9\u067e\u06cc \u0627\u0637\u0644\u0627\u0639\u0627\u062a'} title={'\u06a9\u067e\u06cc \u0627\u0637\u0644\u0627\u0639\u0627\u062a'}>{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}</button></div>
      </div>
    </section>
  </div>, document.body);
}
