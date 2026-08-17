import type { AgentPersona } from "./agent_policy";

export function personaKeyboard() {
  return {
    inline_keyboard: [[
      { text: "Male", callback_data: "ai:persona:male" },
      { text: "Female", callback_data: "ai:persona:female" },
    ]],
  };
}

export async function getAgentPersona(db?: D1Database): Promise<AgentPersona> {
  if (!db) return "female";
  const row = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key='agent_persona'`,
  ).first<{ setting_value: string }>();
  return row?.setting_value === "male" ? "male" : "female";
}

export async function setAgentPersona(
  db: D1Database | undefined,
  ownerId: number,
  persona: AgentPersona,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await db.prepare(
    `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES ('agent_persona', ?1, ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value=excluded.setting_value,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(persona, ownerId).run();
  return `AI persona saved: ${persona === "male" ? "Male" : "Female"}`;
}
