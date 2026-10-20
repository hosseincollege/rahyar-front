'use client';

import { useState } from 'react';
import { Bot, SquareTerminal, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

export type MissionEntryMode = 'form' | 'command' | 'ai';

function parseCommandText(source: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source.trim().replace(/^command\s*/i, ''));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
  return value as Record<string, unknown>;
}

export function MissionQuickActions({ initialMode, onClose, onSelectMode }: { initialMode: MissionEntryMode; onClose: () => void; onSelectMode: (mode: MissionEntryMode) => void }) {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const pathname = usePathname();
  const [mode, setMode] = useState(initialMode);
  const [command, setCommand] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [parsedCommand, setParsedCommand] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const parseCommand = () => {
    try { setParsedCommand(parseCommandText(command)); setError(''); }
    catch { setParsedCommand(null); setError(t('missionCommandInvalid')); }
  };

  const modes: Array<{ id: MissionEntryMode; icon: typeof Bot; label: Parameters<typeof uiMessage>[1] }> = [
    { id: 'command', icon: SquareTerminal, label: 'missionModeCommand' },
    { id: 'ai', icon: Bot, label: 'missionModeAI' },
  ];

  return <section aria-labelledby="mission-quick-title" dir={getLocaleDirection(locale)} className="mx-auto min-h-[calc(100dvh-10rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:p-8">
      <header className="mb-5 flex items-start justify-between gap-3"><div><h2 id="mission-quick-title" className="text-lg font-bold">{t('missionShortcutTitle')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('missionWindowDescription')}</p></div><button type="button" onClick={onClose} aria-label={t('missionClose')} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X size={17}/></button></header>
      <div className="mb-5 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground" dir="ltr">{pathname}</div>
      <div role="tablist" dir="ltr" className="mb-5 grid grid-cols-2 gap-2">{modes.map(({id,icon:Icon,label})=><button key={id} type="button" role="tab" dir={getLocaleDirection(locale)} aria-selected={mode===id} onClick={()=>{setError('');onSelectMode(id);}} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-semibold sm:text-sm ${mode===id?'border-primary bg-primary/10 text-primary':'border-border text-muted-foreground hover:bg-muted'}`}><Icon size={16}/>{t(label)}</button>)}</div>
      {mode === 'command' && <div className="space-y-3"><p className="text-sm text-muted-foreground">{t('missionCommandHelp')}</p><textarea dir="ltr" spellCheck={false} rows={8} value={command} onChange={e=>{setCommand(e.target.value);setParsedCommand(null);}} placeholder={t('missionCommandPlaceholder')} className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"/><button type="button" onClick={parseCommand} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">{t('missionCommandParse')}</button>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{parsedCommand&&<div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-semibold">{t('missionPreview')}</p><pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(parsedCommand,null,2)}</pre><p className="text-xs text-muted-foreground">{t('missionAIUnavailable')}</p></div>}</div>}
      {mode === 'ai' && <div className="space-y-3"><label className="block space-y-2 text-sm"><span>{t('missionAssistantPrompt')}</span><textarea rows={5} value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder={t('missionAIHint')} className="w-full rounded-xl border border-border bg-background px-3 py-2"/></label><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">{t('missionAIUnavailable')}</div></div>}
  </section>;
}
