import { hubClient, setGlobalAuthToken } from '../clients';

export type TelegramStatus = { enabled: boolean; linked: boolean; username?: string | null; botUsername?: string | null };
export type TelegramLinkResult = { url: string; code: string; expiresAt: string };

export async function hubTelegramStatus(token: string): Promise<TelegramStatus> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ telegramStatus: TelegramStatus }>(
    `query TelegramStatus { telegramStatus { enabled linked username botUsername } }` as any,
  );
  return data.telegramStatus;
}

export async function hubCreateTelegramLink(token: string): Promise<TelegramLinkResult> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ createTelegramLink: TelegramLinkResult }>(
    `mutation CreateTelegramLink { createTelegramLink { url code expiresAt } }` as any,
  );
  return data.createTelegramLink;
}

export async function hubUnlinkTelegram(token: string): Promise<boolean> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ unlinkTelegram: boolean }>(`mutation UnlinkTelegram { unlinkTelegram }` as any);
  return data.unlinkTelegram;
}
