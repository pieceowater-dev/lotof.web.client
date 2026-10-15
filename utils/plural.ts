// Picks the right noun form for a count from a "one|few|many" string, so
// "1 заказов" never shows up. Russian uses three forms ("заказ|заказа|заказов"),
// English two ("order|orders"), Kazakh one (the noun does not inflect).
// "{n}" in the chosen form is replaced by the count.
export function plural(n: number, forms: string, locale: string): string {
  const parts = forms.split('|');
  let i = 0;
  if (parts.length >= 3 && locale === 'ru') {
    const m10 = Math.abs(n) % 10;
    const m100 = Math.abs(n) % 100;
    i = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
  } else if (parts.length >= 2 && locale !== 'kk') {
    i = Math.abs(n) === 1 ? 0 : 1;
  }
  return (parts[Math.min(i, parts.length - 1)] || '').replace('{n}', String(n));
}
