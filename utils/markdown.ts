export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFirstImage(markdown: string): { src: string; alt: string } | null {
  const markdownMatch = markdown.match(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/);
  if (markdownMatch) {
    return { src: markdownMatch[2], alt: markdownMatch[1] || '' };
  }

  const htmlMatch = markdown.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
  if (!htmlMatch) return null;
  const altMatch = markdown.match(/<img\s+[^>]*alt=["']([^"']*)["'][^>]*>/i);
  return { src: htmlMatch[1], alt: altMatch?.[1] || '' };
}

export function excerptFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n').map((line) => line.trim());
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('![') || line.startsWith('---')) continue;
    const txt = markdownToPlainText(line);
    if (txt) return txt;
  }
  return markdownToPlainText(markdown).slice(0, 180);
}

export function estimateReadTimeMinutes(markdown: string): number {
  const words = markdownToPlainText(markdown).split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function localeForDateFormatting(locale: string): string {
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'kk') return 'kk-KZ';
  return 'en-GB';
}

export function formatPublishedDate(dateISO: string, locale: string): string {
  const dt = new Date(dateISO);
  if (Number.isNaN(dt.getTime())) return dateISO;
  return dt.toLocaleDateString(localeForDateFormatting(locale), { day: '2-digit', month: 'short', year: 'numeric' });
}
