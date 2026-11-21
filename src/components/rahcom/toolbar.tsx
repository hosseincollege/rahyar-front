'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef, type SVGProps } from 'react';
import { MapPin, WrapText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type RahcomToolbarProps = ComponentPropsWithoutRef<'div'> & {
  as?: 'div' | 'header';
};

const toolbarLabelAliases: ReadonlyArray<[RegExp, string, string]> = [
  [/تمرکز.*استان|استان.*تمرکز|focus.*province/i, 'محدوده', 'Area'],
  [/برچسب|tag/i, 'برچسب', 'Tag'],
  [/انتخاب فایل|بارگذاری|آپلود|upload|choose file/i, 'بارگذاری', 'Upload'],
  [/دانلود|download|تنزيل|baixar/i, 'دانلود', 'Download'],
  [/بازیابی|restore|استعادة|restaurar/i, 'بازیابی', 'Restore'],
  [/ذخیره|save|حفظ|salvar/i, 'ذخیره', 'Save'],
  [/پیچیدن|متن.*خط|wrap|single line/i, 'پیچیدن', 'Wrap'],
  [/افزودن|اضافه|ثبت|ایجاد|جدید|add|create/i, 'افزودن', 'Add'],
  [/همگام.?سازی ابری|cloud sync|backup/i, 'پشتیبان‌گیری', 'Backup'],
];

function conciseToolbarLabel(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim();
  const alias = toolbarLabelAliases.find(([pattern]) => pattern.test(clean));
  if (alias) return clean.match(/[\u0600-\u06ff]/) ? alias[1] : alias[2];
  const words = clean.split(' ').filter(Boolean);
  return words.length > 2 ? words.slice(0, 2).join(' ') : clean;
}

/** Shared toolbar entry point; label sizing and concise names stay consistent across Rahcom. */
export function RahcomToolbar({ as = 'div', className = '', ...props }: RahcomToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const updateLabels = () => {
      toolbar.querySelectorAll<HTMLElement>('[title], [data-toolbar-label]').forEach((control) => {
        const label = control.getAttribute('data-toolbar-label') || control.getAttribute('title');
        if (!label) return;
        const concise = conciseToolbarLabel(label);
        if (control.getAttribute('data-toolbar-label') !== concise) {
          control.setAttribute('data-toolbar-label', concise);
        }
      });
    };

    const animateTaggedTable = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-rahcom-tag-icon]')) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const page = toolbar.closest('main') ?? toolbar.parentElement;
      const table = page?.querySelector<HTMLElement>('table.rahcom-sticky-table, table')
        ?? page?.querySelector<HTMLElement>('.rahcom-table-frame');
      table?.animate(
        [
          { opacity: 0.72, transform: 'translateY(4px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 200, easing: 'ease-out' },
      );
    };

    updateLabels();
    const observer = new MutationObserver(updateLabels);
    observer.observe(toolbar, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'data-toolbar-label'] });
    toolbar.addEventListener('click', animateTaggedTable);
    return () => {
      observer.disconnect();
      toolbar.removeEventListener('click', animateTaggedTable);
    };
  }, []);

  const ToolbarElement = as;
  return (
    <ToolbarElement
      {...props}
      ref={toolbarRef}
      className={['rahcom-toolbar', 'rahcom-page-toolbar', className.trim()].filter(Boolean).join(' ')}
    />
  );
}

export function RahcomLocationIcon({ size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <MapPin size={size} aria-hidden="true" {...props} />;
}

/**
 * Minimal two-document icon reserved for the Systems page Compare control.
 * Keep this separate from RahcomTagIcon; do not redraw or repurpose it without
 * an explicit user request for the Compare control.
 */
export function RahcomCompareIcon({ width = 21, height = 21, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="1.75" y="4.25" width="8.5" height="14" rx="1.5" />
      <rect x="13.75" y="4.25" width="8.5" height="14" rx="1.5" />
    </svg>
  );
}

/** Shared toolbar control for toggling long table text between wrapped and single-line display. */
export function RahcomWrapTextButton({ pressed, onPressedChange, wrapLabel, singleLineLabel }: { pressed: boolean; onPressedChange: () => void; wrapLabel: string; singleLineLabel: string }) {
  const label = pressed ? singleLineLabel : wrapLabel;
  return <button type="button" aria-pressed={pressed} onClick={onPressedChange} aria-label={label} data-toolbar-label={label} title={label} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${pressed ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-primary hover:text-primary'}`}><WrapText size={17} aria-hidden="true" /></button>;
}

type RahcomTagIconProps = SVGProps<SVGSVGElement> & { holeFill?: string };

type RahcomToolbarOptionProps = {
  icon: LucideIcon;
  label: string;
  pressed: boolean;
  onClick: () => void;
  className?: string;
};

/** Icon and help-controlled short label for options inside toolbar switch groups. */
export function RahcomToolbarOption({ icon: Icon, label, pressed, onClick, className = '' }: RahcomToolbarOptionProps) {
  const shortLabel = conciseToolbarLabel(label);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-full shrink-0 items-center justify-center gap-1.5 px-3 transition-colors ${pressed ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'} ${className}`}
    >
      <Icon size={15} aria-hidden="true" />
      <span className="rahcom-toolbar-option-label">{shortLabel}</span>
    </button>
  );
}

/** Shared tag silhouette for toolbar filters across Rahcom pages. */
export function RahcomTagIcon({ holeFill = 'var(--background)', width = 21, height = 21, ...props }: RahcomTagIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-rahcom-tag-icon="true"
      {...props}
    >
      <path d="M8.1 4.5h4.5l8.8 8.8a2 2 0 0 1 0 2.8l-5.3 5.3a2 2 0 0 1-2.8 0l-8.8-8.8V8.1a3.6 3.6 0 0 1 3.6-3.6Z" />
      <circle cx="9.2" cy="9" r="1.35" fill={holeFill} strokeWidth="1.5" />
    </svg>
  );
}
