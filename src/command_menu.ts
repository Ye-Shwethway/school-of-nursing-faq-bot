import type { AdminRole } from "./admin";

export type BotCommand = {
  command: string;
  description: string;
};

const PUBLIC_COMMANDS: BotCommand[] = [
  { command: "start", description: "Start School of Nursing assistant" },
  { command: "whoami", description: "Show my Telegram identity" },
];

const ADMIN_COMMANDS: BotCommand[] = [
  ...PUBLIC_COMMANDS,
  { command: "admin", description: "Open administrator tools" },
  { command: "admins", description: "List authorized administrators" },
  { command: "faq", description: "Manage FAQ knowledge" },
  { command: "adminmanual", description: "Read the Sudo Admin manual" },
];

const OWNER_COMMANDS: BotCommand[] = [
  ...ADMIN_COMMANDS,
  { command: "sudo", description: "Manage Sudo Admin access" },
  { command: "ai", description: "Configure AI agent" },
  { command: "staff", description: "Configure staff and monitoring" },
  { command: "ownermanual", description: "Read or edit the Bot Owner manual" },
  { command: "cancel", description: "Cancel the current setup flow" },
  { command: "reset", description: "Reset transient conversation state" },
];

export const COMMAND_SCHEMA_VERSION = JSON.stringify({
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
