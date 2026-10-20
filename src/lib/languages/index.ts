import fa from './messages/fa';
import type { LocaleMessages } from './types';

type LocaleDefinition = {
  name: string;
  direction: 'rtl' | 'ltr';
  messages: LocaleMessages;
};

/** Single registry for supported locales, display names, direction, and catalogs. */
export const localeRegistry = {
  fa: { name: '\u0641\u0627\u0631\u0633\u06cc', direction: 'rtl', messages: fa },
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
