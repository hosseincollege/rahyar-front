'use client';

import { useState } from 'react';
import { RahcomDataListLayout, RahcomDataListToolbar } from '@/components/rahcom/data-list-layout';
import { usePreferences, getLocaleDirection } from '@/components/providers/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

export default function RahcomInvoicesPage() {
  const { locale } = usePreferences();
  const [query, setQuery] = useState('');
  return <RahcomDataListLayout
    dir={getLocaleDirection(locale)}
    toolbar={<RahcomDataListToolbar
      add={{ label: uiMessage(locale, 'rahcomAdd'), disabled: true }}
      upload={{ label: uiMessage(locale, 'rahcomUploadExcel'), disabled: true }}
      wrap={{ label: uiMessage(locale, 'rahcomWrapLongTableText'), singleLineLabel: uiMessage(locale, 'rahcomKeepTableTextSingleLine'), pressed: false, onToggle: () => undefined, disabled: true }}
      download={{ label: uiMessage(locale, 'solarDownloadExcel'), disabled: true }}
      search={{ value: query, onChange: setQuery, placeholder: uiMessage(locale, 'rahcomInvoicesSearch'), label: uiMessage(locale, 'rahcomInvoicesSearch') }}
      backup={{ open: false, onToggle: () => undefined, label: uiMessage(locale, 'rahcomSaveSystemsBackup'), disabled: true, save: { label: uiMessage(locale, 'rahcomSaveSystemsBackup'), disabled: true }, restore: { label: uiMessage(locale, 'rahcomRestoreSystemsBackup'), disabled: true } }}
    />}
    emptyMessage={query.trim() ? uiMessage(locale, 'rahcomInvoicesNoResults') : uiMessage(locale, 'rahcomInvoicesEmpty')}
    hasRows={false}
  />;
}
