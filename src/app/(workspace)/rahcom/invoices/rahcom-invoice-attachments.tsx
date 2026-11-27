'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { Eye, FileImage, LoaderCircle, Upload } from 'lucide-react';
import { RahcomDialog } from '@/components/rahcom/rahcom-dialog';
import {
  rahcomApi,
  type RahcomInvoiceAttachment,
  type RahcomInvoiceAttachmentCategory,
} from '@/lib/api/rahcom/rahcom-api';

const categories: Array<{ value: RahcomInvoiceAttachmentCategory; label: string }> = [
  { value: 'INVOICE', label: 'تصویر فاکتور یا سند' },
  { value: 'PAYMENT_RECEIPT', label: 'رسید واریز' },
  { value: 'START_PHOTO', label: 'عکس شروع کار' },
  { value: 'END_PHOTO', label: 'عکس پایان کار' },
  { value: 'OTHER', label: 'سایر تصاویر' },
];

function categoryLabel(value: string) {
  return categories.find((category) => category.value === value)?.label ?? 'پیوست';
}

export function RahcomInvoiceAttachments({
  invoiceNumber,
  province,
  attachments,
  onAdded,
  open,
  onClose,
}: {
  invoiceNumber: string;
  province: string;
  attachments: RahcomInvoiceAttachment[];
  onAdded: (attachment: RahcomInvoiceAttachment) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<RahcomInvoiceAttachmentCategory>('INVOICE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; mimeType: string; name: string } | null>(null);
  const invoiceAttachments = attachments.filter((attachment) => attachment.invoiceNumber === invoiceNumber);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const saved = await rahcomApi.uploadInvoiceAttachment({ province, invoiceNumber, category, file });
      onAdded(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیرهٔ تصویر انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function showAttachment(attachment: RahcomInvoiceAttachment) {
    setError('');
    try {
      const blob = await rahcomApi.invoiceAttachmentFile(attachment.id);
      setPreview({ url: URL.createObjectURL(blob), mimeType: attachment.mimeType, name: attachment.originalName });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'بازکردن تصویر انجام نشد.');
    }
  }

  return <>
    <RahcomDialog open={open} onClose={onClose} title={`پیوست‌های سند ${invoiceNumber}`} width="max-w-2xl">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
          <label className="grid min-w-48 flex-1 gap-1 text-xs text-muted-foreground">
            نوع تصویر
            <select value={category} onChange={(event) => setCategory(event.target.value as RahcomInvoiceAttachmentCategory)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
              {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-semibold ${busy ? 'cursor-wait bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
            افزودن تصویر
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" onChange={(event) => void upload(event)} />
          </label>
        </div>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
        {invoiceAttachments.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">برای این سند هنوز تصویری ذخیره نشده است.</p> :
          <ul className="grid gap-2">
            {invoiceAttachments.map((attachment) => <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileImage size={18} className="shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{categoryLabel(attachment.category)}</p>
                  <p className="truncate text-xs text-muted-foreground">{attachment.originalName} · {Math.max(1, Math.round(attachment.size / 1024))} کیلوبایت</p>
                </div>
              </div>
              <button type="button" onClick={() => void showAttachment(attachment)} aria-label={`نمایش ${categoryLabel(attachment.category)}`} className="grid size-9 shrink-0 place-items-center rounded-full border border-border hover:border-primary hover:text-primary"><Eye size={17} /></button>
            </li>)}
          </ul>}
      </div>
    </RahcomDialog>
    {preview && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
      <section role="dialog" aria-modal="true" aria-label={preview.name} className="max-h-[90vh] max-w-[min(96vw,64rem)] overflow-auto rounded-xl bg-background p-3">
        <header className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="truncate">{preview.name}</span><button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-border px-3 py-1">بستن</button></header>
        <img src={preview.url} alt={preview.name} className="max-h-[78vh] max-w-full object-contain" />
      </section>
    </div>}
  </>;
}
