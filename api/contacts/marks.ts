import { crmRequest } from './crmRequest';

export interface ClientMarks {
  rating: number;
  isSupplier: boolean;
  isProblematic: boolean;
  isVip: boolean;
}

export async function updateClientMarks(token: string, ns: string, id: string, marks: ClientMarks) {
  const data = await crmRequest<{ updateClientMarks: ClientMarks }>(
    token, ns,
    `mutation UpdateClientMarks($id: ID!, $rating: Int!, $isSupplier: Boolean!, $isProblematic: Boolean!, $isVip: Boolean!) {
      updateClientMarks(id: $id, rating: $rating, isSupplier: $isSupplier, isProblematic: $isProblematic, isVip: $isVip) {
        rating isSupplier isProblematic isVip
      }
    }`,
    { id, ...marks },
  );
  return data.updateClientMarks;
}
