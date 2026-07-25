-- MatFlow Badges v3: add weekly_consistency criteria type + more milestone badges.
--
-- Changes:
--   1. Extends the badges.criteria_type CHECK to include 'weekly_consistency'
--      so badges can fire when a student trains consistently across weeks.
--   2. Seeds new badge definitions (idempotent via ON CONFLICT DO NOTHING).
--
-- New badge seeds:
--   weekly_consistency : 4 and 8 consecutive qualifying weeks (≥3 classes/wk)
--   classes_attended   : 250 (gap between 100 and the next tier)
--   streak             : 21-day (gap between 14 and 30)
--   belt_rank          : blue (5), purple (6), brown (7), black (8) — journey badges
--
-- weekly_consistency criteria_value = number of consecutive qualifying weeks.
-- The threshold of ≥3 classes/week is enforced in application code
-- (lib/gamification/badges.ts: WEEKLY_CLASS_THRESHOLD).
------------------------------------------------------------------------------

-- Extend the criteria_type check constraint to include 'weekly_consistency'.
ALTER TABLE public.badges
  DROP CONSTRAINT IF EXISTS badges_criteria_type_check;

ALTER TABLE public.badges
  ADD CONSTRAINT badges_criteria_type_check
    CHECK (criteria_type IN (
      'points',
      'streak',
      'classes_attended',
      'belt_rank',
      'challenge_complete',
      'weekly_consistency'
    ));

-- New badge seeds (re-runnable: ON CONFLICT (slug) DO NOTHING)
INSERT INTO public.badges (slug, name, description, icon, criteria_type, criteria_value)
VALUES
  -- Weekly consistency milestones
  ('consistent_crusher', 'Consistent Crusher', 'Train at least 3 times a week for 4 weeks straight.',  '🔄', 'weekly_consistency',  4),
  ('iron_habit',         'Iron Habit',          'Train at least 3 times a week for 8 weeks straight.',  '🔩', 'weekly_consistency',  8),

  -- Classes attended gap filler (100 → 250)
  ('mat_veteran',        'Mat Veteran',         'Attend 250 classes.',                                  '🛡️', 'classes_attended',  250),

  -- Streak gap filler (14 → 30)
  ('three_weeks_strong', 'Three Weeks Strong',  'Maintain a 21-day check-in streak.',                   '🌊', 'streak',             21),

  -- Belt journey badges (criteria_value = ordinal matching BELT_ORDINAL in badges.ts)
  ('blue_belt_grinder',   'Blue Belt Grinder',   'Earned when you receive your blue belt.',              '🥋', 'belt_rank',           5),
  ('purple_belt_pursuer', 'Purple Belt Pursuer', 'Earned when you receive your purple belt.',            '🟣', 'belt_rank',           6),
  ('brown_belt_warrior',  'Brown Belt Warrior',  'Earned when you receive your brown belt.',             '🤎', 'belt_rank',           7),
  ('black_belt_legend',   'Black Belt Legend',   'Earned when you receive your black belt.',             '⬛', 'belt_rank',           8)

ON CONFLICT (slug) DO NOTHING;
