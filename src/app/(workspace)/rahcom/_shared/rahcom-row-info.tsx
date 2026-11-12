'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import Link from 'next/link';
import { Check, ClipboardCopy, ClipboardList, ExternalLink, Info, MapPin, X } from 'lucide-react';
import { iranProvinces, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatRahcomCoordinates } from '@/lib/api/rahcom/rahcom-api';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';

export type RahcomInfoField = { label: string; value: string };
type PopupPosition = { top: number; left: number; maxWidth: number; maxHeight: number };
type RowInfoPopup = { title: string; systemCode: string; fields: RahcomInfoField[]; position: PopupPosition; trigger: HTMLButtonElement; system?: RahcomSystem | null };

export function openRahcomRowInfo(title: string, fields: RahcomInfoField[], trigger?: HTMLElement | null, point?: { x: number; y: number }, systemCode = '', system?: RahcomSystem | null) {
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
  window.dispatchEvent(new CustomEvent<RowInfoPopup>('rahyar:row-info-open', { detail: { title: resolvedTitle, systemCode: resolvedCode, fields: systemFields, system, position: { top, left, maxWidth, maxHeight }, trigger: popupTrigger } }));
}

export function RahcomInfoHeader() {
  return <span role="img" aria-label="Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ø±Ø¯ÛŒÙ" className="inline-grid size-5 place-items-center text-muted-foreground"><Info size={15} /></span>;
}

export function RahcomRowInfo({ title, systemCode = '', fields, system }: { title: string; systemCode?: string; fields: RahcomInfoField[]; system?: RahcomSystem | null }) {
  return <button type="button" aria-label={`Ø§Ø·Ù„Ø§Ø¹Ø§Øª ${title}`} title={`Ø§Ø·Ù„Ø§Ø¹Ø§Øª ${title}`} aria-haspopup="dialog" aria-expanded="false" onClick={(event) => {
      event.stopPropagation();
      openRahcomRowInfo(title, fields, event.currentTarget, { x: event.clientX, y: event.clientY }, system?.systemCode || systemCode, system);
    }} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary aria-expanded:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-rahcom-info-trigger><Info size={16} /></button>;
}

export function RahcomRowInfoHost() {
  const [popup, setPopup] = useState<RowInfoPopup | null>(null);
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<'location' | 'history' | null>(null);
  const activeTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const openPopup = (event: Event) => {
      const nextPopup = (event as CustomEvent<RowInfoPopup>).detail;
      activeTrigger.current = nextPopup.trigger;
      setCopied(false);
      setPanel(null);
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
    setPanel(null);
    flushSync(() => setPopup(null));
  };
  if (!popup || typeof document === 'undefined') return null;
  const axisLabel = popup.fields.find((field) => /axis.*name|name.*axis|نام محور|محور$/i.test(field.label) && !/code|کد/i.test(field.label))?.label || 'محور';
  const provinceLabel = popup.fields.find((field) => /province|استان/i.test(field.label))?.label || 'استان';
  const visibleFields = popup.system ? [
    { label: axisLabel, value: `${popup.system.announcedAxis || '—'}${popup.system.axisCode ? ` / ${popup.system.axisCode}` : ''}` },
    { label: provinceLabel, value: iranProvinces.find(([id]) => id === popup.system?.province)?.[1] || popup.system.province },
  ].filter((field) => field.value.trim() && field.value !== '—') : popup.fields.filter((field) => field.value.trim() !== '');
  const canonicalCode = popup.system?.systemCode || popup.systemCode;
  const canonicalTitle = popup.system?.systemName || popup.title;
  const copyAll = async () => {
    await navigator.clipboard.writeText(`${canonicalCode ? `${canonicalCode}\n` : ''}${canonicalTitle}\n${visibleFields.map((field) => `${field.label}: ${field.value}`).join('\n')}`);
    setCopied(true);
  };
  const systemHref = popup.system ? `/rahcom/systems/${encodeURIComponent(canonicalCode)}?province=${encodeURIComponent(popup.system.province)}` : undefined;
  const coordinates = popup.system && Number.isFinite(popup.system.latitude) && Number.isFinite(popup.system.longitude)
    ? formatRahcomCoordinates(popup.system.latitude, popup.system.longitude)
    : '';
  const locationUrl = (provider: 'google' | 'neshan' | 'balad') => {
    const [latitude, longitude] = coordinates.split(', ');
    if (provider === 'google') return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    if (provider === 'neshan') return `https://maps.neshan.org/?ll=${latitude},${longitude}&z=15`;
    return `https://balad.ir/location?latitude=${latitude}&longitude=${longitude}`;
  };
  return createPortal(<div className="fixed inset-0 z-[1000] bg-transparent" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-label={canonicalTitle} style={{ position: 'fixed', top: popup.position.top, left: popup.position.left, width: popup.position.maxWidth, maxWidth: popup.position.maxWidth, maxHeight: popup.position.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 }} className="rounded-xl border border-border p-2 text-card-foreground shadow-2xl">
      <div className="rahcom-system-popup">
        <header className="rahcom-popup-header"><div className="rahcom-popup-heading"><span className="rahcom-popup-code"><strong className="rahcom-popup-subtitle" dir="ltr">{canonicalCode}</strong></span><strong className="rahcom-popup-title">{canonicalTitle}</strong></div></header>
        <div className="rahcom-popup-data" dir="auto">{visibleFields.map((field, index) => <div key={`${field.label}:${index}`} className="rahcom-popup-row"><span>{field.label}</span><b className="whitespace-pre-wrap">{field.value}</b></div>)}</div>
        <div className="rahcom-popup-actions">
          <button type="button" className="danger" onClick={close} aria-label="بستن" title="بستن"><X size={16} /></button>
          <button type="button" onClick={() => void copyAll()} aria-label="کپی اطلاعات" title="کپی اطلاعات">{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}</button>
          <button type="button" data-popup-action="route" aria-expanded={panel === 'location'} onClick={() => setPanel((current) => current === 'location' ? null : 'location')} aria-label="مسیریابی و مختصات" title="مسیریابی و مختصات"><MapPin size={16} /></button>
          <button type="button" data-popup-action="history" aria-expanded={panel === 'history'} onClick={() => setPanel((current) => current === 'history' ? null : 'history')} aria-label="تاریخچه مراجعات" title="تاریخچه مراجعات"><ClipboardList size={16} /></button>
          {systemHref ? <Link href={systemHref} data-popup-action="system-page" aria-label="صفحه سامانه" title="صفحه سامانه" onClick={close}><ExternalLink size={16} /></Link> : <button type="button" disabled aria-label="صفحه سامانه" title="صفحه سامانه"><ExternalLink size={16} /></button>}
        </div>
        {panel === 'location' && <div className="mt-1 grid gap-1.5 rounded-lg border border-border bg-background p-2 text-xs">
          {coordinates && <button type="button" onClick={() => void navigator.clipboard.writeText(coordinates)} className="flex min-h-9 items-center gap-2 rounded-md px-2 text-start text-foreground hover:bg-muted"><MapPin size={15} />کپی مختصات <bdi dir="ltr" className="ms-auto">{coordinates}</bdi></button>}
          {coordinates && <div className="grid grid-cols-3 gap-1">{([['google', 'Google'], ['neshan', 'نشان'], ['balad', 'بلد']] as const).map(([provider, label]) => <a key={provider} href={locationUrl(provider)} target="_blank" rel="noreferrer" className="flex min-h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-foreground hover:border-primary">{label}<ExternalLink size={13} /></a>)}</div>}
          {!coordinates && <span className="px-2 py-1 text-muted-foreground">مختصات برای این سامانه ثبت نشده است.</span>}
        </div>}
        {panel === 'history' && <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-2">{popup.system ? <RahcomSystemHistory system={popup.system} /> : <span className="text-xs text-muted-foreground">سامانهٔ متناظر پیدا نشد.</span>}</div>}
      </div>
    </section>
  </div>, document.body);
}
