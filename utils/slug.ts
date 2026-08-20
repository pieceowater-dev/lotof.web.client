const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterateCyrillic(value: string): string {
  let out = '';
  for (const ch of String(value || '').toLowerCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return out;
}

export function slugify(value: string): string {
  return transliterateCyrillic(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

// Prefers the English name/title; falls back to transliterating the Russian
// one when English hasn't been filled in yet.
export function slugFromNames(nameEn: string, nameRu: string): string {
  const fromEn = slugify(nameEn);
  if (fromEn) return fromEn;
  return slugify(nameRu);
}

// SKU auto-fill for a good left blank by the user -- transliterates a
// Cyrillic name instead of leaving Cyrillic characters in the code (bad for
// barcode/label printing and for typing an SKU into a scanner/search box).
export function generateSku(name: string): string {
  return slugify(name).toUpperCase().slice(0, 32);
}
