import { Copy, Check } from 'lucide-react';

export type RahcomInfoField = { label: string; value: string };

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
    <header className="rahcom-popup-header"><div className="rahcom-popup-heading"><span className="rahcom-popup-code"><strong className="rahcom-popup-subtitle" dir="ltr">{code}</strong><button type="button" className="rahcom-popup-code-copy" onClick={onCopyCode} aria-label="کپی کد سامانه" title="کپی کد سامانه">{copiedCode ? <Check size={15} /> : <Copy size={15} />}</button></span><strong className="rahcom-popup-title">{title}</strong></div></header>
    <div className="rahcom-popup-data" dir={axis ? 'rtl' : 'auto'}>{fields.map((field, index) => <div key={`${field.label}:${index}`} dir={axis ? 'rtl' : undefined} style={axis ? { direction: 'rtl', textAlign: 'right' } : undefined} className={`rahcom-popup-row${axis ? ' rahcom-popup-axis-row' : ''}`}>{axis ? <b className="rahcom-popup-title rahcom-popup-axis-text">{field.label} {axis.name} {axis.code && <bdi dir="ltr">({axis.code})</bdi>}</b> : <><span>{field.label}</span><b className="whitespace-pre-wrap">{field.value}</b></>}</div>)}</div>
  </>;
}
