import type { AdminRole } from "./admin";

export type BotCommand = {
  command: string;
  description: string;
};

const START_COMMAND: BotCommand = { command: "start", description: "Start School of Nursing assistant" };
const LANGUAGE_COMMAND: BotCommand = { command: "language", description: "Change language" };
const WHOAMI_COMMAND: BotCommand = { command: "whoami", description: "Show my Telegram identity" };
const FAQ_COMMAND: BotCommand = { command: "faq", description: "Browse School of Nursing FAQs" };
const CASES_COMMAND: BotCommand = { command: "cases", description: "Review FAQ escalation cases" };
const LIMITS_COMMAND: BotCommand = { command: "limits", description: "Review user rate limits and bans" };

const PUBLIC_COMMANDS: BotCommand[] = [
  START_COMMAND,
  LANGUAGE_COMMAND,
  FAQ_COMMAND,
  WHOAMI_COMMAND,
];

// Keep privileged ordering stable because production verifies the exact Owner read-back order.
const ADMIN_COMMANDS: BotCommand[] = [
  START_COMMAND,
  LANGUAGE_COMMAND,
  WHOAMI_COMMAND,
  { command: "admin", description: "Open administrator tools" },
  { command: "admins", description: "List authorized administrators" },
  FAQ_COMMAND,
  CASES_COMMAND,
  LIMITS_COMMAND,
  { command: "adminmanual", description: "Read the Sudo Admin manual" },
  { command: "noti", description: "Turn Staff Inbox notifications on or off" },
  { command: "available", description: "Set, schedule or cancel staff availability" },
  { command: "unavailable", description: "Set or cancel timed unavailability" },
];

const OWNER_COMMANDS: BotCommand[] = [
  ...ADMIN_COMMANDS,
  { command: "sudo", description: "Manage Sudo Admin access" },
  { command: "ai", description: "Configure AI agent" },
  { command: "staff", description: "Configure staff and monitoring" },
  { command: "clearmessage", description: "Clear recent Staff Inbox messages" },
  { command: "ownermanual", description: "Read or edit the Bot Owner manual" },
  { command: "cancel", description: "Cancel the current setup flow" },
  { command: "reset", description: "Reset transient conversation state" },
];

const COMMAND_SYNC_REVISION = 11;

export const COMMAND_SCHEMA_VERSION = JSON.stringify({
  revision: COMMAND_SYNC_REVISION,
  public: PUBLIC_COMMANDS,
  admin: ADMIN_COMMANDS,
  owner: OWNER_COMMANDS,
});

export function commandsForRole(role: AdminRole): BotCommand[] {
  if (role === "owner") return OWNER_COMMANDS;
  if (role === "sudo_admin") return ADMIN_COMMANDS;
  return PUBLIC_COMMANDS;
}

export function publicCommands(): BotCommand[] {
  return PUBLIC_COMMANDS;
}

export function commandScopeForPrivateChat(chatId: number) {
  return { type: "chat", chat_id: chatId };
}

export function defaultPrivateScope() {
  return { type: "all_private_chats" };
}
