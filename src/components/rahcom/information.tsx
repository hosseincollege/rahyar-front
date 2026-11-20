import { Copy, Check } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

export type RahcomInfoField = { label: string; value: string };

export type RahcomInformationWindowProps = {
  expanded: boolean;
  title: string;
  position: { top: number; left: number; maxWidth: number; maxHeight: number };
  bounds: { top: number; left: number; width: number; height: number };
  children: ReactNode;
};

/** Single shared compact/full-window surface for every Rahcom information popup. */
export function RahcomInformationWindow({ expanded, title, position, bounds, children }: RahcomInformationWindowProps) {
  const style: CSSProperties = expanded
    ? { position: 'fixed', top: bounds.top, left: bounds.left, width: bounds.width, maxWidth: bounds.width, height: bounds.height, maxHeight: bounds.height, overflowY: 'auto', backgroundColor: 'var(--background)', opacity: 1 }
    : { position: 'fixed', top: position.top, left: position.left, width: position.maxWidth, maxWidth: position.maxWidth, maxHeight: position.maxHeight, overflowY: 'auto', backgroundColor: 'var(--card)', opacity: 1 };

  return <section role="dialog" aria-modal="true" aria-label={title} style={style} className={expanded ? 'border-0 p-4 text-foreground shadow-none' : 'rounded-xl border border-border p-2 text-card-foreground shadow-2xl'}>{children}</section>;
}

export type RahcomInformationProps = {
  title: string;
  code: string;
  fields: RahcomInfoField[];
  copiedCode: boolean;
  onCopyCode: () => void;
  axis?: { name: string; code?: string };
};

/** Shared compact information content used by every Rahcom row-info trigger. */
export function RahcomInformation({ title, code, fields, copiedCode, onCopyCode, axis }: RahcomInformationProps) {
  return <>
    <header className="rahcom-popup-header"><div className="rahcom-popup-heading"><span className="rahcom-popup-code"><strong className="rahcom-popup-subtitle" dir="ltr">{code}</strong><button type="button" className="rahcom-popup-icon-button rahcom-popup-code-copy" onClick={onCopyCode} aria-label="کپی کد سامانه" title="کپی کد سامانه">{copiedCode ? <Check size={16} /> : <Copy size={16} />}</button></span><strong className="rahcom-popup-title">{title}</strong></div></header>
    <div className="rahcom-popup-data" dir={axis ? 'rtl' : 'auto'}>{fields.map((field, index) => <div key={`${field.label}:${index}`} dir={axis ? 'rtl' : undefined} style={axis ? { direction: 'rtl', textAlign: 'right' } : undefined} className={`rahcom-popup-row${axis ? ' rahcom-popup-axis-row' : ''}`}>{axis ? <b className="rahcom-popup-title rahcom-popup-axis-text">{field.label} {axis.name} {axis.code && <bdi dir="ltr">({axis.code})</bdi>}</b> : <><span>{field.label}</span><b className="whitespace-pre-wrap">{field.value}</b></>}</div>)}</div>
  </>;
}
