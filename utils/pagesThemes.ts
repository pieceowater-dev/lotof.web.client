// Site themes for lota Pages. The renderer (lotof.pages.msvc.core/internal/pkg/render/theme.go) is the source of
// truth for what a theme *does*; `pagesThemes.json` is a copy of its embedded themes.json (presets + defaults),
// so the gallery and the live preview use exactly the same values. Keep the two files identical.
import data from './pagesThemes.json';

export type ThemeVars = Record<string, string> & {
  accent: string; bg: string; text: string; heading: string;
  font: string; headingFont: string; radius: string; width: string;
};

export interface ThemePreset { id: string; vars: ThemeVars }

export const DEFAULT_PRESET = 'lota';
const DEFAULTS = data.defaults as unknown as ThemeVars;
export const THEME_PRESETS: ThemePreset[] = (data.presets as { id: string; vars: Record<string, string> }[])
  .map(p => ({ id: p.id, vars: { ...DEFAULTS, ...p.vars } as ThemeVars }));

/** Every non-colour option, grouped for the designer. Values must match the backend enums. */
export const KNOB_GROUPS: { id: string; knobs: { key: string; options: string[] }[] }[] = [
  { id: 'typography', knobs: [
    { key: 'font', options: ['sans', 'serif', 'humanist', 'rounded', 'mono', 'geometric', 'slab', 'oldstyle', 'grotesk', 'didone', 'condensed', 'typewriter', 'optima'] },
    { key: 'headingFont', options: ['sans', 'serif', 'humanist', 'rounded', 'mono', 'geometric', 'slab', 'oldstyle', 'grotesk', 'didone', 'condensed', 'typewriter', 'optima'] },
    { key: 'fontSize', options: ['sm', 'md', 'lg'] },
    { key: 'leading', options: ['tight', 'normal', 'airy'] },
    { key: 'headingWeight', options: ['medium', 'bold', 'black'] },
    { key: 'headingCase', options: ['normal', 'upper'] },
    { key: 'headingAlign', options: ['left', 'center'] },
    { key: 'titleSize', options: ['md', 'lg', 'xl'] },
    { key: 'headingDecor', options: ['none', 'underline', 'bar'] },
  ] },
  { id: 'layout', knobs: [
    { key: 'width', options: ['narrow', 'normal', 'wide', 'xl'] },
    { key: 'spacing', options: ['compact', 'normal', 'airy'] },
    { key: 'radius', options: ['none', 'sm', 'soft', 'lg', 'round'] },
    { key: 'shadow', options: ['none', 'soft', 'lifted'] },
  ] },
  { id: 'header', knobs: [
    { key: 'header', options: ['bar', 'center', 'minimal', 'pill'] },
    { key: 'headerTone', options: ['page', 'soft', 'accent', 'dark'] },
    { key: 'nav', options: ['plain', 'underline', 'pills'] },
    { key: 'mobileNav', options: ['burger', 'inline'] },
    { key: 'sticky', options: ['no', 'yes'] },
    { key: 'logoSize', options: ['sm', 'md', 'lg'] },
    { key: 'showName', options: ['yes', 'no'] },
  ] },
  { id: 'content', knobs: [
    { key: 'links', options: ['underline', 'hover', 'plain'] },
    { key: 'images', options: ['plain', 'shadow', 'border'] },
    { key: 'quote', options: ['bar', 'mark', 'plain'] },
    { key: 'bgStyle', options: ['flat', 'dots', 'grid', 'glow'] },
  ] },
  { id: 'footer', knobs: [
    { key: 'footerTone', options: ['page', 'soft', 'accent', 'dark'] },
    { key: 'footerAlign', options: ['left', 'center'] },
  ] },
];

const ENUMS: Record<string, string[]> = Object.fromEntries(KNOB_GROUPS.flatMap(g => g.knobs.map(k => [k.key, k.options])));

/** Backgrounds come as readable background + text pairs, so no combination can be illegible. */
export const BACKGROUNDS: { id: string; bg: string; text: string }[] = [
  { id: 'white', bg: '#ffffff', text: '#1e293b' },
  { id: 'snow', bg: '#f8fafc', text: '#0f172a' },
  { id: 'cream', bg: '#fffaf5', text: '#3b2a20' },
  { id: 'paper', bg: '#fdfcf8', text: '#292524' },
  { id: 'sand', bg: '#f5f1e8', text: '#1a1a1a' },
  { id: 'mint', bg: '#f6faf6', text: '#1b2a1f' },
  { id: 'sky', bg: '#f3fafc', text: '#0b2530' },
  { id: 'lilac', bg: '#faf7ff', text: '#2a2140' },
  { id: 'blush', bg: '#fff5f7', text: '#4a1d2f' },
  { id: 'lemon', bg: '#fffbeb', text: '#422006' },
  { id: 'graphite', bg: '#111418', text: '#e6e9ef' },
  { id: 'midnight', bg: '#0f172a', text: '#e2e8f0' },
  { id: 'navy', bg: '#082f49', text: '#e0f2fe' },
  { id: 'espresso', bg: '#1c1410', text: '#f3e8dc' },
  { id: 'ink', bg: '#0a0a0a', text: '#fafafa' },
  { id: 'black', bg: '#000000', text: '#f5f5f5' },
];

/** Curated accent palette for sites (no free colour wheel, same rule as the rest of the product). */
export const SITE_ACCENTS = [
  '#2563eb', '#4f46e5', '#6d28d9', '#7c3aed', '#c026d3', '#be185d', '#e11d48', '#ef4444',
  '#c2410c', '#d97706', '#b45309', '#92400e', '#15803d', '#166534', '#0f766e', '#0d9488',
  '#0e7490', '#0284c7', '#1e3a8a', '#475569', '#18181b', '#7aa2ff', '#38bdf8', '#34d399', '#fbbf24', '#ffffff',
];

/** Optional heading colour; '' keeps headings in the text colour. */
export const HEADING_COLORS = ['#0f172a', '#1e3a8a', '#6d28d9', '#9a3412', '#166534', '#be185d', '#ffffff', '#fbbf24'];

export const FONT_STACKS: Record<string, string> = {
  sans: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  serif: 'Georgia,"Iowan Old Style","Palatino Linotype","Times New Roman",serif',
  humanist: '"Trebuchet MS","Gill Sans",Candara,Calibri,"Segoe UI",sans-serif',
  rounded: 'ui-rounded,"SF Pro Rounded","Hiragino Maru Gothic ProN",Nunito,"Varela Round",system-ui,sans-serif',
  mono: 'ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace',
  geometric: '"Avenir Next",Avenir,"Century Gothic","URW Gothic",Futura,"Trebuchet MS",system-ui,sans-serif',
  slab: 'Rockwell,"Rockwell Nova","Roboto Slab",Arvo,Georgia,serif',
  oldstyle: '"Palatino Linotype",Palatino,"Book Antiqua","URW Palladio L",Georgia,serif',
  grotesk: '"Helvetica Neue",Helvetica,Arial,"Liberation Sans",sans-serif',
};

const RADIUS_PX: Record<string, { card: string; btn: string }> = {
  none: { card: '0', btn: '0' },
  sm: { card: '6px', btn: '4px' },
  soft: { card: '10px', btn: '8px' },
  lg: { card: '16px', btn: '12px' },
  round: { card: '18px', btn: '999px' },
};
export const radiusPx = (r: string) => RADIUS_PX[r] ?? RADIUS_PX.soft;

export function presetById(id: string): ThemePreset {
  return THEME_PRESETS.find(p => p.id === id) ?? THEME_PRESETS.find(p => p.id === DEFAULT_PRESET) ?? THEME_PRESETS[0];
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Preset values with the owner's saved overrides applied (same rules as the backend). */
export function resolveVars(presetId: string, overridesJson: string): ThemeVars {
  const base = { ...presetById(presetId).vars };
  let o: Record<string, string> = {};
  try { o = JSON.parse(overridesJson || '{}') || {}; } catch { o = {}; }
  for (const k of ['accent', 'bg', 'text']) if (HEX.test(o[k] || '')) base[k] = o[k].toLowerCase();
  if (o.heading === '' || HEX.test(o.heading || '')) base.heading = (o.heading || '').toLowerCase();
  for (const [k, opts] of Object.entries(ENUMS)) if (opts.includes(o[k])) base[k] = o[k];
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

export function contrast(a: string, b: string): number {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: string, b: string, pct: number): string {
  const n = (h: string) => { const x = h.replace('#', ''); const f = x.length === 3 ? x.split('').map(c => c + c).join('') : x; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); };
  const A = n(a), B = n(b);
  return '#' + A.map((v, i) => Math.round(v * pct / 100 + B[i] * (100 - pct) / 100).toString(16).padStart(2, '0')).join('');
}

/** Text colour on top of the accent (matches the backend's onColor). */
export function onAccent(hex: string): string {
  const l = lum(hex);
  return 1.05 / (l + 0.05) >= ((l + 0.05) / 0.05) * 0.6 ? '#ffffff' : '#111111';
}

/** Header / footer band colours for a tone (matches the backend's tone()). */
export function toneColors(v: ThemeVars, name: string): { bg: string; fg: string } {
  if (name === 'soft') return { bg: mix(v.text, v.bg, 6), fg: v.text };
  if (name === 'dark') return { bg: '#111418', fg: '#e6e9ef' };
  if (name === 'accent') {
    if (contrast('#ffffff', v.accent) >= 4.5) return { bg: v.accent, fg: '#ffffff' };
    if (contrast('#111111', v.accent) >= 4.5) return { bg: v.accent, fg: '#111111' };
    let c = v.accent;
    for (let p = 10; p <= 100; p += 10) { c = mix('#000000', v.accent, p); if (contrast('#ffffff', c) >= 4.5) break; }
    return { bg: c, fg: '#ffffff' };
  }
  return { bg: v.bg, fg: v.text };
}

export function isDark(bg: string): boolean {
  return lum(bg) < 0.25;
}
