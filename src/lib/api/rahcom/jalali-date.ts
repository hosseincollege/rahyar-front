function dateParts(value: Date, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
}

export function formatJalaliDate(isoDate: string) {
  const match = isoDate.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const parts = dateParts(new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`));
  return `${parts.year}/${parts.month}/${parts.day}`;
}

export function todayJalaliDate() {
  const parts = dateParts(new Date(), 'Asia/Tehran');
  return `${parts.year}/${parts.month}/${parts.day}`;
}

function toAsciiDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String.fromCharCode(
    digit.charCodeAt(0) >= 0x06f0 && digit.charCodeAt(0) <= 0x06f9
      ? digit.charCodeAt(0) - 0x06f0 + 48
      : digit.charCodeAt(0) - 0x0660 + 48,
  ));
}

export function jalaliDateToGregorian(value: string): string | null {
  const match = toAsciiDigits(value.trim()).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const expected = match.slice(1).map(Number);
  const cursor = new Date(Date.UTC(expected[0] + 621, 0, 1, 12));
  for (let day = 0; day < 370; day += 1) {
    const parts = dateParts(cursor);
    if ([Number(parts.year), Number(parts.month), Number(parts.day)].every((part, index) => part === expected[index])) {
      return cursor.toISOString().slice(0, 10);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}
