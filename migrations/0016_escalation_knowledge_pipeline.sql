ALTER TABLE escalation_cases ADD COLUMN reason TEXT;
ALTER TABLE escalation_cases ADD COLUMN linked_faq_key TEXT;

CREATE INDEX IF NOT EXISTS idx_escalation_cases_linked_faq
ON escalation_cases(linked_faq_key);
