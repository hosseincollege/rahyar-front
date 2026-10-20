import { localeRegistry, type Locale } from './languages';
import type { UiMessage } from './languages/types';

export function uiMessage(locale: Locale, key: UiMessage): string {
  return localeRegistry[locale].messages[key];
}
