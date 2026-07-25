-- MatFlow Badges v2: extend criteria_type + seed additional milestone badges.
--
-- Changes:
--   1. Extends the badges.criteria_type CHECK to include 'challenge_complete'
--      so badges can fire when a user completes Passport Challenges.
--   2. Seeds new badge definitions (idempotent via ON CONFLICT DO NOTHING).
--
-- New badge seeds:
--   classes_attended: 25-class milestone (gap between 10 and 50)
--   streak:           14-day (gap between 7 and 30)
--   points:           50-pt starter, 250-pt master
--   challenge_complete: first challenge, 5 challenges
------------------------------------------------------------------------------

-- Extend the criteria_type check constraint to include 'challenge_complete'.
-- PostgreSQL names inline CHECK constraints as <table>_<col>_check by default.
ALTER TABLE public.badges
  DROP CONSTRAINT IF EXISTS badges_criteria_type_check;

ALTER TABLE public.badges
  ADD CONSTRAINT badges_criteria_type_check
    CHECK (criteria_type IN (
      'points',
      'streak',
      'classes_attended',
      'belt_rank',
      'challenge_complete'
    ));

-- New badge seeds (re-runnable: ON CONFLICT (slug) DO NOTHING)
INSERT INTO public.badges (slug, name, description, icon, criteria_type, criteria_value)
VALUES
  -- classes_attended gap filler
  ('twenty_five_classes', 'Quarter Century',    'Attend 25 classes.',                         '🎖️', 'classes_attended',   25),
  -- streak gap filler between 7 and 30
  ('two_week_streak',     'Two Weeks Strong',   'Maintain a 14-day check-in streak.',         '🌟', 'streak',             14),
  -- lower points milestone (earnable early on)
  ('point_starter',       'Point Starter',      'Earn your first 50 points.',                 '✨', 'points',             50),
  -- mid-tier points milestone (gap between 100 and 500)
  ('point_master',        'Point Master',       'Earn 250 points.',                           '💫', 'points',            250),
  -- challenge_complete milestones
  ('first_challenge',     'Challenge Accepted', 'Complete your first Passport Challenge.',    '🏆', 'challenge_complete',  1),
  ('five_challenges',     'Challenge Champion', 'Complete 5 Passport Challenges.',            '👑', 'challenge_complete',  5)
ON CONFLICT (slug) DO NOTHING;
