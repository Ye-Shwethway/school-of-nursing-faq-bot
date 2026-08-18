-- Normalize legacy manual seed text that stored the two literal characters \n
-- instead of a real line break. This migration changes presentation only.
UPDATE manual_sections
SET body = replace(body, '\n', char(10)),
    updated_at = CURRENT_TIMESTAMP
WHERE instr(body, '\n') > 0;
