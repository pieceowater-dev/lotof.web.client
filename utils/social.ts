export type SocialLink = { label: string; url: string };

// brandSettings.socialLinks is stored backend-side as a free-form JSON
// string column (no dedicated schema) — this is the shape this codebase
// writes into it: a simple array of {label, url} pairs.
export function parseSocialLinks(json: string | null | undefined): SocialLink[] {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.url === 'string' && x.url.trim())
      .map((x) => ({ label: String(x.label || '').trim(), url: String(x.url).trim() }));
  } catch {
    return [];
  }
}

export function serializeSocialLinks(links: SocialLink[]): string {
  return JSON.stringify(links.filter((l) => l.url.trim()));
}

const ICON_BY_KEYWORD: Array<[string, string]> = [
  ['instagram', 'lucide:instagram'],
  ['facebook', 'lucide:facebook'],
  ['twitter', 'lucide:twitter'],
  ['whatsapp', 'lucide:message-circle'],
  ['telegram', 'lucide:send'],
  ['youtube', 'lucide:youtube'],
  ['tiktok', 'lucide:music-2'],
  ['linkedin', 'lucide:linkedin'],
];

export function socialIcon(label: string): string {
  const l = label.toLowerCase();
  for (const [keyword, icon] of ICON_BY_KEYWORD) {
    if (l.includes(keyword)) return icon;
  }
  return 'lucide:link';
}
