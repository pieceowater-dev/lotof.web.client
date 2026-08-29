// Safari/WebKit's fetch() does not reliably preserve FormData part order when
// a Blob/File field is mixed with string fields -- it can put "file" on the
// wire before "operations", which gqlgen's multipart transport rejects with
// "first part must be operations" since it streams parts and expects
// "operations" first. Renaming the file field away from a numeric key does
// NOT fix this (that was a prior misdiagnosis baked into every call site).
//
// Building the multipart body ourselves with an explicit boundary fixes the
// ordering, but handing fetch() a Blob body is still not enough on Safari:
// the first upload after page load intermittently goes out with a mangled or
// missing Content-Type / truncated body (hence "works on the second try").
// The only fully reliable fix is to materialize the whole body into an
// ArrayBuffer -- concrete bytes fetch() sends verbatim, with our explicit
// Content-Type header, and no Blob streaming/type quirks in play.
export async function buildGraphqlUploadBody(
  operations: Record<string, unknown>,
  map: Record<string, string[]>,
  fileFieldName: string,
  file: File,
): Promise<{ body: ArrayBuffer; contentType: string }> {
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

  const body = await new Blob(parts).arrayBuffer();

  // The body must be at least the file plus the boundary/header framing --
  // if it came back smaller than the file alone, the File part didn't
  // serialize (a Safari nested-Blob bug) and sending it would produce the
  // exact "first part must be operations" failure on the server. Fail loud.
  if (body.byteLength < file.size) {
    throw new Error('Failed to assemble the upload body — please try again');
  }

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}
