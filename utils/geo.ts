export function twoGisSearchHref(query: string): string {
  return `https://2gis.kz/search/${encodeURIComponent(query)}`;
}

export function twoGisPinHref(lat: number, lng: number): string {
  return `https://2gis.kz/geo/${lng},${lat}`;
}

// openstreetmap.org's embeddable iframe view — no API key required, good
// enough for a "here's roughly where this branch is" preview and for the
// pin-drop picker in branch creation.
export function osmEmbedSrc(lat: number, lng: number, spanDeg = 0.01): string {
  const d = spanDeg / 2;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lng}`;
}
