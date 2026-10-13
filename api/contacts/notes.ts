import { crmRequest } from './crmRequest';

export interface NoteAttachment {
  id?: string;
  fileUrl: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
}

export interface ClientNote {
  id: string;
  clientId: string;
  authorId?: string | null;
  body: string;
  pinned: boolean;
  important: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  attachments: NoteAttachment[];
}

const NOTE_FIELDS = /* GraphQL */ `
  id clientId authorId body pinned important deleted createdAt updatedAt
  attachments { id fileUrl fileName mime sizeBytes }
`;

export async function listClientNotes(token: string, ns: string, clientId: string, includeDeleted = false) {
  const data = await crmRequest<{ clientNotes: { rows: ClientNote[]; info: { count: number } } }>(
    token, ns,
    `query ClientNotes($clientId: ID!, $includeDeleted: Boolean) {
      clientNotes(clientId: $clientId, includeDeleted: $includeDeleted) { rows { ${NOTE_FIELDS} } info { count } }
    }`,
    { clientId, includeDeleted },
  );
  return data.clientNotes.rows;
}

export async function createClientNote(
  token: string, ns: string, clientId: string,
  input: { body: string; pinned?: boolean; important?: boolean; attachments?: NoteAttachment[] },
) {
  const data = await crmRequest<{ createClientNote: ClientNote }>(
    token, ns,
    `mutation CreateClientNote($clientId: ID!, $body: String!, $pinned: Boolean, $important: Boolean, $attachments: [NoteAttachmentInput!]) {
      createClientNote(clientId: $clientId, body: $body, pinned: $pinned, important: $important, attachments: $attachments) { ${NOTE_FIELDS} }
    }`,
    {
      clientId, body: input.body, pinned: !!input.pinned, important: !!input.important,
      attachments: (input.attachments || []).map(a => ({ fileUrl: a.fileUrl, fileName: a.fileName, mime: a.mime, sizeBytes: a.sizeBytes })),
    },
  );
  return data.createClientNote;
}

export async function updateClientNote(token: string, ns: string, id: string, body: string, important: boolean) {
  const data = await crmRequest<{ updateClientNote: ClientNote }>(
    token, ns,
    `mutation UpdateClientNote($id: ID!, $body: String!, $important: Boolean) {
      updateClientNote(id: $id, body: $body, important: $important) { ${NOTE_FIELDS} }
    }`,
    { id, body, important },
  );
  return data.updateClientNote;
}

export async function pinClientNote(token: string, ns: string, id: string, pinned: boolean) {
  const data = await crmRequest<{ pinClientNote: ClientNote }>(
    token, ns,
    `mutation PinClientNote($id: ID!, $pinned: Boolean!) { pinClientNote(id: $id, pinned: $pinned) { ${NOTE_FIELDS} } }`,
    { id, pinned },
  );
  return data.pinClientNote;
}

export async function deleteClientNote(token: string, ns: string, id: string) {
  const data = await crmRequest<{ deleteClientNote: ClientNote }>(
    token, ns, `mutation DeleteClientNote($id: ID!) { deleteClientNote(id: $id) { ${NOTE_FIELDS} } }`, { id },
  );
  return data.deleteClientNote;
}

export async function restoreClientNote(token: string, ns: string, id: string) {
  const data = await crmRequest<{ restoreClientNote: ClientNote }>(
    token, ns, `mutation RestoreClientNote($id: ID!) { restoreClientNote(id: $id) { ${NOTE_FIELDS} } }`, { id },
  );
  return data.restoreClientNote;
}
