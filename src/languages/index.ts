import ar from './messages/ar';
import de from './messages/de';
import en from './messages/en';
import es from './messages/es';
import fa from './messages/fa';
import fr from './messages/fr';
import ja from './messages/ja';
import ptBR from './messages/pt-BR';
import ru from './messages/ru';
import zhCN from './messages/zh-CN';
import type { LocaleMessages } from './types';

type LocaleDefinition = {
  name: string;
  direction: 'rtl' | 'ltr';
  messages: LocaleMessages;
};

/** Single registry for supported locales, display names, direction, and catalogs. */
export const localeRegistry = {
  fa: { name: 'فارسی', direction: 'rtl', messages: fa },
  en: { name: 'English', direction: 'ltr', messages: en },
  ar: { name: 'العربية', direction: 'rtl', messages: ar },
  'zh-CN': { name: '中文（简体）', direction: 'ltr', messages: zhCN },
  fr: { name: 'Français', direction: 'ltr', messages: fr },
  es: { name: 'Español', direction: 'ltr', messages: es },
  de: { name: 'Deutsch', direction: 'ltr', messages: de },
  ru: { name: 'Русский', direction: 'ltr', messages: ru },
  ja: { name: '日本語', direction: 'ltr', messages: ja },
  'pt-BR': { name: 'Português (Brasil)', direction: 'ltr', messages: ptBR },
} as const satisfies Record<string, LocaleDefinition>;

export type Locale = keyof typeof localeRegistry;
export type LocaleDirection = LocaleDefinition['direction'];

export const supportedLocales = Object.keys(localeRegistry) as Locale[];

export const localeOptions = Object.entries(localeRegistry).map(([id, locale]) => ({
  id: id as Locale,
  name: locale.name,
  direction: locale.direction,
}));

export function getLocaleDirection(locale: Locale): LocaleDirection {
  return localeRegistry[locale].direction;
}
