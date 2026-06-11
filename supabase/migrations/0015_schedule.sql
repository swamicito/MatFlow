-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_schedule.sql  –  Weekly class schedule + student bookings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS classes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  instructor_name text        NOT NULL DEFAULT '',
  day_of_week     int         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0 = Sunday, 1 = Monday, ... 6 = Saturday  (JS getDay() convention)
  start_time      time        NOT NULL,
  end_time        time        NOT NULL,
  capacity        int         NOT NULL DEFAULT 20 CHECK (capacity > 0),
  is_recurring    boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classes_gym_day
  ON classes (gym_id, day_of_week, start_time);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS class_bookings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('confirmed', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS class_bookings_class
  ON class_bookings (class_id) WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS class_bookings_student
  ON class_bookings (student_id) WHERE status = 'confirmed';
