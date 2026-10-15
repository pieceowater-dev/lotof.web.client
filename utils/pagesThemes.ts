// Site themes for lota Pages. The renderer (lotof.pages.msvc.core/internal/pkg/render/theme.go) is the
// source of truth for what a theme *does*; this file mirrors the preset values so the console can show a
// gallery and a live preview. Keep ids and values in sync with the backend presets.

export type ThemeFont = 'sans' | 'serif' | 'humanist' | 'rounded' | 'mono';
export type ThemeRadius = 'none' | 'soft' | 'round';
export type ThemeWidth = 'narrow' | 'normal' | 'wide';
export type ThemeHeader = 'bar' | 'center';

export interface ThemeVars {
  accent: string; bg: string; text: string;
  font: ThemeFont; headingFont: ThemeFont;
  radius: ThemeRadius; width: ThemeWidth; header: ThemeHeader;
}

export interface ThemePreset { id: string; vars: ThemeVars }

export const DEFAULT_PRESET = 'classic';

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'classic', vars: { accent: '#2563eb', bg: '#ffffff', text: '#1e293b', font: 'sans', headingFont: 'sans', radius: 'soft', width: 'normal', header: 'bar' } },
  { id: 'night', vars: { accent: '#7aa2ff', bg: '#111418', text: '#e6e9ef', font: 'sans', headingFont: 'sans', radius: 'soft', width: 'normal', header: 'bar' } },
  { id: 'warm', vars: { accent: '#c2410c', bg: '#fffaf5', text: '#3b2a20', font: 'humanist', headingFont: 'humanist', radius: 'round', width: 'normal', header: 'bar' } },
  { id: 'forest', vars: { accent: '#15803d', bg: '#f6faf6', text: '#1b2a1f', font: 'sans', headingFont: 'sans', radius: 'soft', width: 'normal', header: 'bar' } },
  { id: 'ocean', vars: { accent: '#0e7490', bg: '#f3fafc', text: '#0b2530', font: 'rounded', headingFont: 'rounded', radius: 'round', width: 'wide', header: 'center' } },
  { id: 'mono', vars: { accent: '#18181b', bg: '#ffffff', text: '#18181b', font: 'sans', headingFont: 'sans', radius: 'none', width: 'narrow', header: 'bar' } },
  { id: 'editorial', vars: { accent: '#9a3412', bg: '#fdfcf8', text: '#292524', font: 'serif', headingFont: 'serif', radius: 'none', width: 'narrow', header: 'center' } },
];

/** Backgrounds come as readable background + text pairs, so no combination can be illegible. */
export const BACKGROUNDS: { id: string; bg: string; text: string }[] = [
  { id: 'white', bg: '#ffffff', text: '#1e293b' },
  { id: 'cream', bg: '#fffaf5', text: '#3b2a20' },
  { id: 'paper', bg: '#fdfcf8', text: '#292524' },
  { id: 'mint', bg: '#f6faf6', text: '#1b2a1f' },
  { id: 'sky', bg: '#f3fafc', text: '#0b2530' },
  { id: 'lilac', bg: '#faf7ff', text: '#2a2140' },
  { id: 'graphite', bg: '#111418', text: '#e6e9ef' },
  { id: 'midnight', bg: '#0f172a', text: '#e2e8f0' },
];

/** Curated accent palette for sites (no free colour wheel, same rule as the rest of the product). */
export const SITE_ACCENTS = [
  '#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#e11d48', '#c2410c', '#d97706', '#15803d',
  '#0d9488', '#0e7490', '#0284c7', '#475569', '#18181b', '#7aa2ff', '#34d399', '#fbbf24',
];

export const FONT_STACKS: Record<ThemeFont, string> = {
  sans: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  serif: 'Georgia,"Iowan Old Style","Palatino Linotype","Times New Roman",serif',
  humanist: '"Trebuchet MS","Gill Sans",Candara,Calibri,"Segoe UI",sans-serif',
  rounded: 'ui-rounded,"SF Pro Rounded","Hiragino Maru Gothic ProN",Nunito,"Varela Round",system-ui,sans-serif',
  mono: 'ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace',
};

export const FONTS: ThemeFont[] = ['sans', 'serif', 'humanist', 'rounded', 'mono'];
export const RADII: ThemeRadius[] = ['none', 'soft', 'round'];
export const WIDTHS: ThemeWidth[] = ['narrow', 'normal', 'wide'];
export const HEADERS: ThemeHeader[] = ['bar', 'center'];

const RADIUS_PX: Record<ThemeRadius, { card: string; btn: string }> = {
  none: { card: '0', btn: '0' },
  soft: { card: '10px', btn: '8px' },
  round: { card: '18px', btn: '999px' },
};
export const radiusPx = (r: ThemeRadius) => RADIUS_PX[r] ?? RADIUS_PX.soft;

export function presetById(id: string): ThemePreset {
  return THEME_PRESETS.find(p => p.id === id) ?? THEME_PRESETS[0];
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Preset values with the owner's saved overrides applied (same rules as the backend). */
export function resolveVars(presetId: string, overridesJson: string): ThemeVars {
  const base = { ...presetById(presetId).vars };
  let o: Record<string, string> = {};
  try { o = JSON.parse(overridesJson || '{}') || {}; } catch { o = {}; }
  if (HEX.test(o.accent || '')) base.accent = o.accent.toLowerCase();
  if (HEX.test(o.bg || '')) base.bg = o.bg.toLowerCase();
  if (HEX.test(o.text || '')) base.text = o.text.toLowerCase();
  if (o.font in FONT_STACKS) base.font = o.font as ThemeFont;
  if (o.headingFont in FONT_STACKS) base.headingFont = o.headingFont as ThemeFont;
  if ((RADII as string[]).includes(o.radius)) base.radius = o.radius as ThemeRadius;
  if ((WIDTHS as string[]).includes(o.width)) base.width = o.width as ThemeWidth;
  if ((HEADERS as string[]).includes(o.header)) base.header = o.header as ThemeHeader;
  return base;
}

function lum(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const ch = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

/** Text colour on top of the accent (matches the backend's onColor). */
export function onAccent(hex: string): string {
  const l = lum(hex);
  return 1.05 / (l + 0.05) >= ((l + 0.05) / 0.05) * 0.6 ? '#ffffff' : '#111111';
}

export function isDark(bg: string): boolean {
  return lum(bg) < 0.25;
}
