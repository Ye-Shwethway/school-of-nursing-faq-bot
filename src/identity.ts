export type StoredTelegramIdentity = {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type TelegramIdentityInput = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export function formatTelegramIdentity(user: TelegramIdentityInput): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const username = user.username ? `@${user.username}` : "";
  const label = [name || "Unknown name", username].filter(Boolean).join(" ");
  return `${label} — ID: ${user.id}`;
}

export async function getStoredTelegramIdentity(
  db: D1Database | undefined,
  telegramUserId: number,
): Promise<StoredTelegramIdentity | null> {
  if (!db) return null;
  return db.prepare(
    `SELECT telegram_user_id, username, first_name, last_name
     FROM users WHERE telegram_user_id=?1`,
  ).bind(telegramUserId).first<StoredTelegramIdentity>();
}

export async function describeTelegramUser(
  db: D1Database | undefined,
  telegramUserId: number,
): Promise<string> {
  const stored = await getStoredTelegramIdentity(db, telegramUserId);
  if (!stored) return `Unknown name — ID: ${telegramUserId}`;
  return formatTelegramIdentity({
    id: stored.telegram_user_id,
    username: stored.username ?? undefined,
    first_name: stored.first_name ?? undefined,
    last_name: stored.last_name ?? undefined,
  });
}
