// Nuxt's build-time chunk manifest links the Leaflet ("maps") stylesheet on
// every page, not just the few (menu branch picker, atrace post map) that
// actually render a map -- confirmed by code review that nothing outside
// those two components statically imports 'leaflet/dist/leaflet.css'
// anymore. That makes it pure render-blocking dead weight everywhere else
// (PageSpeed's "Render-blocking requests" insight). Rather than fight
// Nuxt's manifest-driven <link> generation, rewrite it post-render into the
// standard non-blocking "media=print, swap on load" pattern -- it still
// loads in the background and applies instantly once map components mount,
// via their own dynamic import of the same stylesheet.
//
// Each entry in html.head/bodyAppend can be a batch of several concatenated
// tags, not one tag per entry -- replace only the matching <link> substring
// in place, never the whole entry, or every other tag batched alongside it
// gets silently dropped.
const MAPS_STYLESHEET_RE = /<link\s+rel="stylesheet"\s+href="([^"]*\/_nuxt\/maps\.[^"]+)"[^>]*>/g;

function deferMapsStylesheet(entry: string): string {
  if (!entry.includes('/_nuxt/maps.')) return entry;
  return entry.replace(
    MAPS_STYLESHEET_RE,
    (_match, href) =>
      `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'" crossorigin>` +
      `<noscript><link rel="stylesheet" href="${href}" crossorigin></noscript>`,
  );
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head = html.head.map(deferMapsStylesheet);
    html.bodyAppend = html.bodyAppend.map(deferMapsStylesheet);
  });
});
