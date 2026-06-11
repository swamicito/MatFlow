-- ─────────────────────────────────────────────────────────────────────────────
-- 0014_messaging.sql  –  In-app messaging (gym → student, bidirectional)
-- ─────────────────────────────────────────────────────────────────────────────

-- Conversations thread container
CREATE TABLE IF NOT EXISTS conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  subject     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_gym_updated
  ON conversations (gym_id, updated_at DESC);

-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type      text        NOT NULL CHECK (sender_type IN ('owner', 'student')),
  sender_id        uuid        NOT NULL,
  -- sender_id = gym_id  when sender_type = 'owner'
  -- sender_id = students.id  when sender_type = 'student'
  content          text        NOT NULL,
  read_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created
  ON messages (conversation_id, created_at ASC);

-- Which students belong to a conversation
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id)      ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, student_id)
);

CREATE INDEX IF NOT EXISTS conversation_participants_student
  ON conversation_participants (student_id);

-- Auto-bump conversations.updated_at whenever a new message arrives
CREATE OR REPLACE FUNCTION _bump_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_bump_conversation ON messages;
CREATE TRIGGER trg_messages_bump_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION _bump_conversation_updated_at();

-- Enable Realtime for the messages table (needed for live updates)
ALTER TABLE messages  REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
