// First-party proxy for Amplitude event ingestion. Ad blockers/privacy
// extensions routinely block requests to amplitude.com by domain; routing
// through our own origin instead means they never see a third-party
// tracker domain to block. Amplitude's HTTP API v2 takes the api_key
// inside the JSON body (not a header), so this needs no server-side
// secret -- it's a transparent passthrough of whatever the client SDK sends.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const upstream = await fetch('https://api2.amplitude.com/2/httpapi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  setResponseStatus(event, upstream.status);
  setHeader(event, 'Content-Type', upstream.headers.get('content-type') || 'application/json');
  return text;
});
