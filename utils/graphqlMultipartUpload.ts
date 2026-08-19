// Safari/WebKit's fetch() does not reliably preserve FormData part order when
// a Blob/File field is mixed with string fields -- it can put "file" on the
// wire before "operations", which gqlgen's multipart transport rejects with
// "first part must be operations" since it streams parts and expects
// "operations" first. Renaming the file field away from a numeric key does
// NOT fix this (that was a prior misdiagnosis baked into every call site).
// The only reliable fix is to not depend on the browser's FormData encoder at
// all: build the multipart/form-data body ourselves with an explicit
// boundary, so part order is guaranteed byte-for-byte regardless of browser.
export function buildGraphqlUploadBody(
  operations: Record<string, unknown>,
  map: Record<string, string[]>,
  fileFieldName: string,
  file: File,
): { body: Blob; contentType: string } {
  const boundary = `lota-${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const CRLF = '\r\n';

  const field = (name: string, value: string) =>
    `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

  const parts: BlobPart[] = [
    field('operations', JSON.stringify(operations)),
    field('map', JSON.stringify(map)),
    `--${boundary}${CRLF}Content-Disposition: form-data; name="${fileFieldName}"; filename="${file.name}"${CRLF}Content-Type: ${file.type || 'application/octet-stream'}${CRLF}${CRLF}`,
    file,
    CRLF,
    `--${boundary}--${CRLF}`,
  ];

  return { body: new Blob(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}
