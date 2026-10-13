import { getApiBaseUrl } from '@/utils/api-base';

export type UploadedClientFile = { ref: string; key: string; name: string; mime: string; size: number; url: string };

// Stores a photo or document of a client in the workspace's file storage. The
// answer's `ref` goes into the note; `url` is a signed address valid for an hour
// (used for the preview straight away).
export async function uploadClientFile(token: string, file: File): Promise<UploadedClientFile> {
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(`${getApiBaseUrl('contacts')}/files/upload`, {
    method: 'POST',
    headers: { ContactsAuthorization: `Bearer ${token}` },
    body: form,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error || `Upload failed with status ${res.status}`));
  return data as UploadedClientFile;
}
