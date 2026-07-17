// Mirrors lotof.menu.msvc.core's ent.SocialLink exactly — { link, name,
// description } with `name` a small int enum (see social_links.go). This
// must stay in lockstep with the backend's SocialEnum ordering; previously
// this file used an ad-hoc {label, url} shape that the backend's
// json.Unmarshal silently accepted but produced all-zero-value entries for
// (Go ignores unknown JSON keys and leaves missing fields at their zero
// value), which looked like "social links don't save" from the UI.
// `prefix` is what auto-fills the link field the moment a platform is
// picked (see BrandSection.vue's onPlatformChange) — the customer-facing
// win is not retyping "https://wa.me/" from memory every time, just
// appending the number/handle after it. Left blank where there's no
// sensible universal prefix (email/phone vary too much to guess).
export const SOCIAL_PLATFORMS = [
  { value: 0, label: 'WhatsApp', icon: 'lucide:message-circle', placeholder: 'https://wa.me/77001234567', prefix: 'https://wa.me/' },
  { value: 1, label: 'Telegram', icon: 'lucide:send', placeholder: 'https://t.me/username', prefix: 'https://t.me/' },
  { value: 2, label: 'Email', icon: 'lucide:mail', placeholder: 'mailto:hello@example.com', prefix: 'mailto:' },
  { value: 3, label: 'Instagram', icon: 'lucide:instagram', placeholder: 'https://instagram.com/username', prefix: 'https://instagram.com/' },
  { value: 4, label: 'Facebook', icon: 'lucide:facebook', placeholder: 'https://facebook.com/username', prefix: 'https://facebook.com/' },
  { value: 5, label: 'TikTok', icon: 'lucide:music-2', placeholder: 'https://tiktok.com/@username', prefix: 'https://tiktok.com/@' },
  { value: 6, label: 'Viber', icon: 'lucide:phone-call', placeholder: 'viber://chat?number=77001234567', prefix: 'viber://chat?number=' },
  { value: 7, label: 'Phone', icon: 'lucide:phone', placeholder: 'tel:+77001234567', prefix: 'tel:+' },
  { value: 8, label: 'Website', icon: 'lucide:globe', placeholder: 'https://example.com', prefix: 'https://' },
] as const;

export type SocialLink = { name: number; link: string; description?: string };

export function parseSocialLinks(json: string | null | undefined): SocialLink[] {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.link === 'string' && x.link.trim())
      .map((x) => ({
        name: typeof x.name === 'number' ? x.name : 0,
        link: String(x.link).trim(),
        description: x.description ? String(x.description) : undefined,
      }));
  } catch {
    return [];
  }
}

export function serializeSocialLinks(links: SocialLink[]): string {
  return JSON.stringify(
    links
      .filter((l) => l.link.trim())
      .map((l) => ({ name: l.name, link: l.link.trim(), description: l.description || '' }))
  );
}

export function socialPlatform(name: number) {
  return SOCIAL_PLATFORMS.find((p) => p.value === name) || SOCIAL_PLATFORMS[8];
}

export function socialIcon(name: number): string {
  return socialPlatform(name).icon;
}

export function socialLabel(name: number): string {
  return socialPlatform(name).label;
}
