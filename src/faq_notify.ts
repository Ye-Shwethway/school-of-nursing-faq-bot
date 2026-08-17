import { getStaffInboxChatId } from "./handoff";
import { describeTelegramUser } from "./identity";
import type { FaqMutationResult } from "./faq_store";

export type FaqNotifierSend = (
  chatId: number,
  text: string,
  options?: { disableNotification?: boolean },
) => Promise<unknown>;

function parseOwnerId(value?: string): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const id = Number(value.trim());
  return Number.isSafeInteger(id) ? id : null;
}

async function adminIds(db: D1Database): Promise<number[]> {
  const rows = await db.prepare(
    `SELECT telegram_user_id FROM admin_roles WHERE role='sudo_admin' ORDER BY granted_at ASC`,
  ).all<{ telegram_user_id: number }>();
  return (rows.results ?? []).map((row) => row.telegram_user_id);
}

export async function faqChangeSummary(
  db: D1Database,
  result: FaqMutationResult,
  actorId: number,
): Promise<string> {
  const entry = result.entry;
  return [
    "FAQ Knowledge Updated",
    `Action: ${result.action}`,
    `Key: ${entry.key}`,
    `Version: ${entry.version}`,
    `Active: ${entry.active ? "yes" : "no"}`,
    `Changed by: ${await describeTelegramUser(db, actorId)}`,
    "",
    `MY: ${entry.question.my}`,
    `EN: ${entry.question.en}`,
    `ZH: ${entry.question.zh}`,
  ].join("\n");
}

export async function notifyFaqChange(
  db: D1Database | undefined,
  ownerIdValue: string | undefined,
  actorId: number,
  result: FaqMutationResult,
  send: FaqNotifierSend,
): Promise<void> {
  if (!db) return;
  const targets = new Set<number>();
  const ownerId = parseOwnerId(ownerIdValue);
  if (ownerId !== null) targets.add(ownerId);
  for (const id of await adminIds(db)) targets.add(id);

  const text = await faqChangeSummary(db, result, actorId);
  for (const target of targets) {
    try {
      await send(target, text);
    } catch {
      // Notification delivery is best-effort and must not roll back FAQ mutations.
    }
  }

  const staffInbox = await getStaffInboxChatId(db);
  if (staffInbox) {
    try {
      await send(staffInbox, text);
    } catch {
      // The FAQ change is already committed; group notification failure is non-fatal.
    }
  }
}
