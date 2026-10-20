export type DisplayCalendar = 'persian' | 'islamic' | 'gregorian';

const intlCalendar: Record<DisplayCalendar, string> = {
  persian: 'persian',
  islamic: 'islamic-umalqura',
  gregorian: 'gregory',
};

/** Returns the selected calendar extension while preserving the requested language. */
export function getCalendarLocale(locale: string): string {
  const selected = typeof document === 'undefined'
    ? 'persian'
    : document.documentElement.dataset.calendar;
  const calendar = selected === 'islamic' || selected === 'gregorian' || selected === 'persian'
    ? selected
    : 'persian';
  return `${locale.replace(/-u-.*$/i, '')}-u-ca-${intlCalendar[calendar]}`;
}
