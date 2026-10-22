import faMessages from './fa-messages';

export type Locale = 'fa';
export type UiMessage = keyof typeof faMessages;

export function uiMessage(_locale: Locale, key: UiMessage): string {
  return faMessages[key];
}
