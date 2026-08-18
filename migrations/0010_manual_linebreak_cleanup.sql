-- Convert legacy literal backslash-n sequences from the initial manual seed into real line breaks.
UPDATE manual_sections
SET body = replace(body, '\n', char(10)),
    updated_at = CURRENT_TIMESTAMP
WHERE instr(body, '\n') > 0;
