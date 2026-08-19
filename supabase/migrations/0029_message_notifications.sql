-- Debounce state for student message notifications.
--
-- One row per (conversation, student): the last time we emailed/SMSed that
-- student about that conversation. The notify path skips a student if the
-- row is younger than the debounce window (10 minutes), so a chat burst
-- sends at most one notification per window.

CREATE TABLE IF NOT EXISTS message_notifications (
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  student_id      uuid        NOT NULL REFERENCES students(id)      ON DELETE CASCADE,
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, student_id)
);
