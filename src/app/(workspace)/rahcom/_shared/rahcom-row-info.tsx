'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Check, ClipboardList, Copy, Info, MapPin, Maximize2, Minimize2, Pencil, X, Zap } from 'lucide-react';
import { hasRahcomCoordinates, iranProvinces, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatRahcomCoordinates } from '@/lib/api/rahcom/rahcom-api';
import { rahcomLongOutageReasonLabel } from '@/lib/api/rahcom/solar-status';
import { RahcomSystemHistory } from '@/app/(workspace)/rahcom/_shared/rahcom-system-history';
import { RahcomCopyPreview } from '@/app/(workspace)/rahcom/_shared/rahcom-copy-preview';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

export type RahcomInfoField = { label: string; value: string };
export type RahcomElectricityDetail = { label: string; value: string };
type PopupPosition = { top: number; left: number; maxWidth: number; maxHeight: number };
type RowInfoPopup = { title: string; systemCode: string; fields: RahcomInfoField[]; position: PopupPosition; trigger: HTMLButtonElement; system?: RahcomSystem | null; onEdit?: () => void; electricityDetails?: RahcomElectricityDetail[]; previewBeforeCopy?: boolean };

function getWorkspaceMainBounds() {
  const workspaceMain = document.querySelector<HTMLElement>('[data-workspace-main]');
  if (workspaceMain) return workspaceMain.getBoundingClientRect();
  const pageMain = document.querySelector('main');
  return pageMain?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

export function openRahcomRowInfo(title: string, fields: RahcomInfoField[], trigger?: HTMLElement | null, point?: { x: number; y: number }, systemCode = '', system?: RahcomSystem | null, onEdit?: () => void, electricityDetails?: RahcomElectricityDetail[], previewBeforeCopy = false) {
  const resolvedCode = systemCode || fields.find((field) => /system\s*code|کد\s*(?:سامانه|ایستگاه)/i.test(field.label))?.value || '';
  const resolvedTitle = fields.find((field) => /system\s*name|systemname|نام\s*(?:سامانه|ایستگاه)|nome.*sistema|nom.*système|nombre.*sistema|назван.*систем|系统名称|システム名|اسم النظام/i.test(field.label) && field.value.trim())?.value || title;
  const systemFields = fields.filter((field) => field.value.trim() !== '' && field.value !== resolvedCode && field.value !== resolvedTitle && /axis|محور|استان|province|província|provincia|провинц|محافظة|المحافظ|ولاية|จังหวัด|省/i.test(field.label));
  const bounds = getWorkspaceMainBounds();
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
  window.dispatchEvent(new CustomEvent<RowInfoPopup>('rahyar:row-info-open', { detail: { title: resolvedTitle, systemCode: resolvedCode, fields: system ? systemFields : fields, system, onEdit, electricityDetails, previewBeforeCopy, position: { top, left, maxWidth, maxHeight }, trigger: popupTrigger } }));
}

export function RahcomInfoHeader() {
  return <span role="img" aria-label={'\u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0631\u062f\u06cc\u0641'} className="inline-grid size-5 place-items-center text-muted-foreground"><Info size={15} /></span>;
}

export function RahcomRowInfo({ title, systemCode = '', fields, system, onEdit, electricityDetails, previewBeforeCopy = false }: { title: string; systemCode?: string; fields: RahcomInfoField[]; system?: RahcomSystem | null; onEdit?: () => void; electricityDetails?: RahcomElectricityDetail[]; previewBeforeCopy?: boolean }) {
  return <button type="button" aria-label={`\u0627\u0637\u0644\u0627\u0639\u0627\u062a ${title}`} title={`\u0627\u0637\u0644\u0627\u0639\u0627\u062a ${title}`} aria-haspopup="dialog" aria-expanded="false" onClick={(event) => {
      event.stopPropagation();
      openRahcomRowInfo(title, fields, event.currentTarget, { x: event.clientX, y: event.clientY }, system?.systemCode || systemCode, system, onEdit, electricityDetails, previewBeforeCopy);
    }} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary aria-expanded:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-rahcom-info-trigger><Info size={16} /></button>;
}

export function RahcomRowInfoHost() {
  const { locale } = usePreferences();
  const [popup, setPopup] = useState<RowInfoPopup | null>(null);
  const [copyPreview, setCopyPreview] = useState('');
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);
  const [electricityCopiedKey, setElectricityCopiedKey] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<'location' | 'history' | 'electricity' | null>(null);
  const activeTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const openPopup = (event: Event) => {
      const nextPopup = (event as CustomEvent<RowInfoPopup>).detail;
      activeTrigger.current = nextPopup.trigger;
      setCopied(false);
      setCodeCopied(false);
      setCoordinatesCopied(false);
      setElectricityCopiedKey('');
      setExpanded(false);
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
  const contentBounds = getWorkspaceMainBounds();
  const axisLabel = 'محور:';
  const visibleFields = popup.system
    ? [{ label: axisLabel, value: `${popup.system.announcedAxis || '\u2014'}${popup.system.axisCode ? ` (${popup.system.axisCode})` : ''}` }].filter((field) => field.value.trim() && field.value !== '\u2014')
    : popup.fields.filter((field) => field.value.trim() !== '');
  const canonicalCode = popup.system?.systemCode || popup.systemCode;
  const canonicalTitle = popup.system?.systemName || popup.title;
  const electricityDetails = [
    ...(popup.system?.electricityBillId ? [{ label: '\u0634\u0646\u0627\u0633\u0647 \u0642\u0628\u0636 \u0628\u0631\u0642', value: popup.system.electricityBillId }] : []),
    ...(popup.electricityDetails ?? []),
  ].filter((detail, index, details) => detail.value.trim() && details.findIndex((candidate) => candidate.label === detail.label && candidate.value === detail.value) === index);
  const copyAll = async () => {
    const copyText = popup.system
      ? `سامانه ${canonicalCode} موقعیت ${canonicalTitle}\nمحور ${popup.system.announcedAxis || '—'}${popup.system.axisCode ? ` (${popup.system.axisCode})` : ''}`
      : `${canonicalCode ? `${canonicalCode}\n` : ''}${canonicalTitle}\n${visibleFields.map((field) => `${field.label}: ${field.value}`).join('\n')}`;
    if (popup.previewBeforeCopy) { setCopyPreview(copyText); return; }
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
  };
  const copyCode = async () => {
    await navigator.clipboard.writeText(canonicalCode);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 900);
  };
  const coordinates = popup.system && hasRahcomCoordinates(popup.system)
    ? formatRahcomCoordinates(popup.system.latitude, popup.system.longitude)
    : '';
  const incidentTypeLabel = popup.system?.incidentType === 'THEFT' ? 'سرقت' : popup.system?.incidentType === 'DAMAGE' ? 'تخریب' : popup.system?.incidentType === 'THEFT_AND_DAMAGE' ? 'سرقت و تخریب' : popup.system?.incidentType === 'WIDENING_RELOCATION' ? 'تعریض و جابجایی' : '';
  const provinceLabel = popup.system
    ? iranProvinces.find(([id]) => id === popup.system?.province)?.[1] ?? popup.system.province
    : '';
  const expandedSections: { title: string; fields: RahcomInfoField[] }[] = popup.system
    ? [
        {
          title: 'سامانه و موقعیت',
          fields: [
            { label: 'کد سامانه', value: popup.system.systemCode },
            { label: 'نام سامانه', value: popup.system.systemName },
            { label: 'استان', value: provinceLabel },
            { label: 'نام ایستگاه', value: popup.system.stationName || '—' },
            { label: 'کد تجمیع', value: popup.system.aggregationCode || '—' },
            { label: 'نام محور', value: popup.system.announcedAxis || '—' },
            { label: 'کد محور', value: popup.system.axisCode || '—' },
            { label: 'مختصات', value: coordinates || '—' },
            { label: 'عرض جغرافیایی', value: String(popup.system.latitude ?? '—') },
            { label: 'طول جغرافیایی', value: String(popup.system.longitude ?? '—') },
          ],
        },
        {
          title: 'برق و تجهیزات',
          fields: [
            { label: 'شناسه قبض برق', value: popup.system.electricityBillId || '—' },
            { label: 'IP سیم‌کارت', value: popup.system.simIp || '—' },
            { label: 'IP رادار', value: popup.system.radarIp || '—' },
            { label: 'IP دوربین', value: popup.system.cameraIp || '—' },
            { label: 'IP کامپیوتر', value: popup.system.pcIp || '—' },
            { label: 'IP روتر', value: popup.system.routerIp || '—' },
            { label: 'IP لپ‌تاپ', value: popup.system.laptopIp || '—' },
          ],
        },
        {
          title: 'وضعیت و توضیحات',
          fields: [
            { label: 'نوع سرقت و تخریب', value: incidentTypeLabel || 'ندارد' },
            { label: 'جزئیات سرقت و تخریب', value: popup.system.incidentDetails || '—' },
            { label: 'قطعی زمان‌بر', value: popup.system.longOutage ? 'دارد' : 'ندارد' },
            { label: 'دلیل قطعی زمان‌بر', value: popup.system.longOutageReason ? rahcomLongOutageReasonLabel(popup.system.longOutageReason, popup.system.longOutageDetails) : '—' },
            { label: 'توضیحات قطعی زمان‌بر', value: popup.system.longOutageDetails || '—' },
            { label: 'توضیحات سامانه', value: popup.system.details || '—' },
          ],
        },
        {
          title: 'اطلاعات ثبت',
          fields: [
            { label: 'تاریخ ایجاد', value: new Date(popup.system.createdAt).toLocaleString('fa-IR') },
            { label: 'آخرین ویرایش', value: new Date(popup.system.updatedAt).toLocaleString('fa-IR') },
          ],
        },
      ]
    : [{ title: canonicalTitle, fields: popup.fields }];
  const googleMapsUrl = () => {
    const [latitude, longitude] = coordinates.split(', ');
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  };
  const appShell = document.querySelector<HTMLElement>('.erp-app-shell');
  // Keep the compact popup on its original document-level theme. Expanded
  // details live inside the app shell so they inherit the active workspace theme.
  const portalRoot = expanded ? appShell ?? document.body : document.body;
  return createPortal(<>
  <div className="fixed inset-0 z-[1000] bg-transparent" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-label={canonicalTitle} style={expanded ? { position: 'fixed', top: contentBounds.top, left: contentBounds.left, width: contentBounds.width, maxWidth: contentBounds.width, height: contentBounds.height, maxHeight: contentBounds.height, overflowY: 'auto', backgroundColor: 'var(--background)', opacity: 1 } : { position: 'fixed', top: popup.position.top, left: popup.position.left, width: popup.position.maxWidth, maxWidth: popup.position.maxWidth, maxHeight: popup.position.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 }} className={expanded ? 'border-0 p-4 text-foreground shadow-none' : 'rounded-xl border border-border p-2 text-card-foreground shadow-2xl'}>
      <div className={`rahcom-system-popup${expanded ? ' rahcom-system-popup-expanded' : ''}`}>
        <header className="rahcom-popup-header"><div className="rahcom-popup-heading"><span className="rahcom-popup-code"><strong className="rahcom-popup-subtitle" dir="ltr">{canonicalCode}</strong><button type="button" className="rahcom-popup-code-copy" onClick={() => void copyCode()} aria-label="کپی کد سامانه" title="کپی کد سامانه">{codeCopied ? <Check size={15} /> : <Copy size={15} />}</button></span><strong className="rahcom-popup-title">{canonicalTitle}</strong></div></header>
        <div className="rahcom-popup-data" dir={popup.system ? 'rtl' : 'auto'}>{visibleFields.map((field, index) => <div key={`${field.label}:${index}`} dir={popup.system ? 'rtl' : undefined} style={popup.system ? { direction: 'rtl', textAlign: 'right' } : undefined} className={`rahcom-popup-row${popup.system ? ' rahcom-popup-axis-row' : ''}`}>{popup.system ? <b className="rahcom-popup-title rahcom-popup-axis-text">{field.label} {popup.system.announcedAxis} {popup.system.axisCode && <bdi dir="ltr">({popup.system.axisCode})</bdi>}</b> : <><span>{field.label}</span><b className="whitespace-pre-wrap">{field.value}</b></>}</div>)}</div>
        <div className={`rahcom-popup-actions${expanded ? ' rahcom-popup-actions-expanded' : ''}`}>
          {popup.system && <button type="button" data-popup-action="electricity" aria-expanded={panel === 'electricity'} onClick={() => setPanel((current) => current === 'electricity' ? null : 'electricity')} aria-label="اطلاعات برق" title="اطلاعات برق"><Zap size={16} /></button>}
          {popup.onEdit && <button type="button" onClick={() => { const edit = popup.onEdit; close(); edit?.(); }} aria-label="ویرایش رکورد" title="ویرایش رکورد"><Pencil size={16} /></button>}
          {!popup.system && <button type="button" data-popup-action="expand" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'کوچک‌کردن پنجره' : 'نمایش جزئیات'} title={expanded ? 'کوچک‌کردن پنجره' : 'نمایش جزئیات'}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>}
          <button type="button" className="danger" onClick={close} aria-label="بستن" title="بستن"><X size={16} /></button>
          <button type="button" onClick={() => void copyAll()} aria-label="کپی اطلاعات" title="کپی اطلاعات">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
          {popup.system && hasRahcomCoordinates(popup.system) && <button type="button" data-popup-action="route" aria-expanded={panel === 'location'} onClick={() => setPanel((current) => current === 'location' ? null : 'location')} aria-label="مسیریابی و مختصات" title="مسیریابی و مختصات"><MapPin size={16} /></button>}
          {popup.system && <button type="button" data-popup-action="history" aria-expanded={panel === 'history'} onClick={() => setPanel((current) => current === 'history' ? null : 'history')} aria-label="تاریخچه مراجعات" title="تاریخچه مراجعات"><ClipboardList size={16} /></button>}
          {popup.system && <button type="button" data-popup-action="expand" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'کوچک‌کردن پنجره' : 'نمایش جزئیات سامانه'} title={expanded ? 'کوچک‌کردن پنجره' : 'نمایش جزئیات سامانه'}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>}
        </div>
        {panel === 'electricity' && <div className="mt-1 grid gap-1.5 rounded-lg border border-border bg-background p-2">
          {electricityDetails.length ? electricityDetails.map((detail, index) => {
            const copyKey = `${detail.label}:${detail.value}`;
            return <div key={`${copyKey}:${index}`} className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
              <div className="min-w-0"><span className="block text-[11px] text-muted-foreground">{detail.label}</span><bdi dir="ltr" className="block break-all text-sm text-foreground">{detail.value}</bdi></div>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(detail.value).then(() => { setElectricityCopiedKey(copyKey); window.setTimeout(() => setElectricityCopiedKey(''), 900); }); }} className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary" aria-label={`کپی ${detail.label}`} title={electricityCopiedKey === copyKey ? 'کپی شد' : `کپی ${detail.label}`}>{electricityCopiedKey === copyKey ? <Check size={15} /> : <Copy size={15} />}</button>
            </div>;
          }) : <span className="px-2 py-1 text-xs text-muted-foreground">اطلاعات برق برای این سامانه ثبت نشده است.</span>}
        </div>}
        {expanded && <div className="space-y-4 p-1">{expandedSections.map((group) => <section key={group.title} aria-label={group.title} className="space-y-2"><h3 className="border-b border-border/70 pb-1 text-sm font-semibold text-foreground">{group.title}</h3><div className="rahcom-details-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{group.fields.map((field) => <div key={field.label} className="min-w-0 rounded-lg border border-border/70 bg-card p-3"><div className="text-xs text-muted-foreground">{field.label}</div><div dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{field.value || '—'}</div></div>)}</div></section>)}</div>}
        {panel === 'location' && popup.system && hasRahcomCoordinates(popup.system) && <div className="mt-1 flex min-h-9 items-center gap-1.5 text-xs">
          {coordinates && <><bdi dir="ltr" className="min-w-0 shrink-0 text-end text-foreground">{coordinates}</bdi><button type="button" onClick={() => { void navigator.clipboard.writeText(coordinates).then(() => { setCoordinatesCopied(true); window.setTimeout(() => setCoordinatesCopied(false), 900); }); }} className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary" aria-label="کپی مختصات" title="کپی مختصات">{coordinatesCopied ? <Check size={15} /> : <Copy size={15} />}</button><a href={googleMapsUrl()} target="_blank" rel="noreferrer" className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background font-bold text-base text-[#4285f4] hover:border-primary hover:bg-muted" aria-label="Google Maps" title="Google Maps">G</a></>}
          {!coordinates && <span className="px-2 py-1 text-muted-foreground">مختصات برای این سامانه ثبت نشده است.</span>}
        </div>}
        {panel === 'history' && <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-2">{popup.system ? <RahcomSystemHistory system={popup.system} /> : <span className="text-xs text-muted-foreground">سامانهٔ متناظر پیدا نشد.</span>}</div>}
      </div>
    </section>
  </div>
  <RahcomCopyPreview open={Boolean(copyPreview)} title={uiMessage(locale, 'rahcomCopy')} text={copyPreview} locale={locale} onClose={() => setCopyPreview('')} />
  </>, portalRoot);
}
