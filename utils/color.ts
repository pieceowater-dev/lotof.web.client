// Tenants pick their own brand colors, including ones too light for white
// text to stay readable on. This picks whichever of black/white text has
// the higher WCAG contrast ratio against a given background color, so
// text painted on top of an arbitrary primary/secondary color is always
// legible instead of assuming "brand color → white text" always holds.

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function getContrastTextColor(backgroundHex: string, dark = '#111827', light = '#ffffff'): string {
  const rgb = hexToRgb(backgroundHex)
  if (!rgb) return light
  const bgLum = relativeLuminance(rgb.r, rgb.g, rgb.b)
  const contrastWithWhite = contrastRatio(bgLum, 1)
  const contrastWithBlack = contrastRatio(bgLum, 0)
  return contrastWithBlack > contrastWithWhite ? dark : light
}
