// Public lead form of an Issues board: the key is derived from the board's
// webhook secret exactly as the gateway derives it (HMAC-SHA256 of
// "lead:<boardId>", first 24 hex characters), so the secret itself is never
// put on a public page.

export async function leadKey(webhookSecret: string, boardId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`lead:${boardId}`)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

export function leadEndpoint(origin: string, apiBasePath: string, ns: string, boardId: string, key: string): string {
  return `${origin}${apiBasePath}/lead/${ns}/boards/${boardId}?key=${key}`;
}

/** A ready-to-paste contact form for any website. */
export function leadFormSnippet(endpoint: string, labels: { name: string; phone: string; comment: string; send: string; thanks: string }): string {
  return `<form id="lota-lead">
  <input name="name" placeholder="${labels.name}">
  <input name="phone" placeholder="${labels.phone}" required>
  <textarea name="comment" placeholder="${labels.comment}"></textarea>
  <input name="website" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">${labels.send}</button>
</form>
<script>
document.getElementById('lota-lead').addEventListener('submit', function (e) {
  e.preventDefault();
  var f = e.target, data = Object.fromEntries(new FormData(f));
  data.page = location.href;
  var q = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (q.get(k)) data[k] = q.get(k); });
  fetch('${endpoint}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(function (r) { if (r.ok) { f.reset(); alert('${labels.thanks}'); } });
});
</script>`;
}
