import { getStaffInboxChatId } from "./handoff";
import { getMonitoringTopic, saveMonitoringTopic } from "./monitoring";

export type MonitoringUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type MonitoringTargetEnv = {
  DB?: D1Database;
};

export type TelegramApi = (method: string, body: unknown) => Promise<any | null>;

function topicTitle(user: MonitoringUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "User";
  const username = user.username ? ` · @${user.username}` : "";
  return `${name}${username} · ID ${user.id}`.slice(0, 120);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshTopicTitle(
  telegramApi: TelegramApi,
  staffChatId: number,
  threadId: number,
  user: MonitoringUser,
): Promise<void> {
  await telegramApi("editForumTopic", {
    chat_id: staffChatId,
    message_thread_id: threadId,
    name: topicTitle(user),
  });
}

export async function ensureIsolatedMonitoringTarget(
  env: MonitoringTargetEnv,
  user: MonitoringUser,
  telegramApi: TelegramApi,
): Promise<{ chatId: number; threadId: number } | null> {
  if (!env.DB) return null;
  const staffChatId = await getStaffInboxChatId(env.DB);
  if (!staffChatId) return null;

  const existing = await getMonitoringTopic(env.DB, user.id, staffChatId);
  if (existing) {
    await refreshTopicTitle(telegramApi, staffChatId, existing, user);
    return { chatId: staffChatId, threadId: existing };
  }

  // Clear an abandoned provision lock. Normal topic creation should complete in seconds.
  await env.DB.prepare(
    `DELETE FROM monitoring_topic_provision_locks
     WHERE telegram_user_id=?1 AND staff_chat_id=?2
       AND datetime(acquired_at) < datetime('now', '-30 seconds')`,
  ).bind(user.id, staffChatId).run();

  const claim = await env.DB.prepare(
    `INSERT OR IGNORE INTO monitoring_topic_provision_locks
      (telegram_user_id, staff_chat_id, acquired_at)
     VALUES (?1, ?2, CURRENT_TIMESTAMP)`,
  ).bind(user.id, staffChatId).run();

  if ((claim.meta.changes ?? 0) !== 1) {
    // Another request for this same user is creating the topic. Wait briefly for the
    // canonical mapping instead of creating a duplicate or leaking into the main group.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await sleep(125);
      const provisioned = await getMonitoringTopic(env.DB, user.id, staffChatId);
      if (provisioned) {
        await refreshTopicTitle(telegramApi, staffChatId, provisioned, user);
        return { chatId: staffChatId, threadId: provisioned };
      }
    }
    return null;
  }

  try {
    // Re-check after claiming in case a previous request completed just before the lock.
    const afterClaim = await getMonitoringTopic(env.DB, user.id, staffChatId);
    if (afterClaim) {
      await refreshTopicTitle(telegramApi, staffChatId, afterClaim, user);
      return { chatId: staffChatId, threadId: afterClaim };
    }

    const topic = await telegramApi("createForumTopic", {
      chat_id: staffChatId,
      name: topicTitle(user),
    });
    const threadId = Number(topic?.message_thread_id);
    if (!Number.isSafeInteger(threadId)) return null;

    await saveMonitoringTopic(env.DB, user.id, staffChatId, threadId);
    return { chatId: staffChatId, threadId };
  } finally {
    await env.DB.prepare(
      `DELETE FROM monitoring_topic_provision_locks
       WHERE telegram_user_id=?1 AND staff_chat_id=?2`,
    ).bind(user.id, staffChatId).run();
  }
}
