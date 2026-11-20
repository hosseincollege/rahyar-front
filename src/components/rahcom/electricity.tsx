import { Check, Copy } from 'lucide-react';
import type { RahcomInfoField } from './information';

export type RahcomElectricityDetail = RahcomInfoField;

type RahcomElectricityProps = {
  details: RahcomElectricityDetail[];
  copiedKey: string;
  onCopy: (detail: RahcomElectricityDetail) => void;
};

/** Shared compact electricity summary shown inside Rahcom information popups. */
export function RahcomElectricity({ details, copiedKey, onCopy }: RahcomElectricityProps) {
  return <div className="mt-1 grid gap-1.5 rounded-lg border border-border bg-background p-2">
    {details.length ? details.map((detail, index) => {
      const copyKey = `${detail.label}:${detail.value}`;
      return <div key={`${copyKey}:${index}`} className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
        <div className="min-w-0"><span className="block text-[11px] text-muted-foreground">{detail.label}</span><bdi dir="ltr" className="block break-all text-sm text-foreground">{detail.value}</bdi></div>
        <button type="button" onClick={() => onCopy(detail)} className="rahcom-popup-icon-button rounded-md" aria-label={`کپی ${detail.label}`} title={copiedKey === copyKey ? 'کپی شد' : `کپی ${detail.label}`}>{copiedKey === copyKey ? <Check size={16} /> : <Copy size={16} />}</button>
      </div>;
    }) : <span className="px-2 py-1 text-xs text-muted-foreground">اطلاعات برق برای این سامانه ثبت نشده است.</span>}
  </div>;
}
