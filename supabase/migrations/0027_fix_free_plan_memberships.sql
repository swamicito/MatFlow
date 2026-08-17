-- One-time cleanup: memberships created before the Trial/Pending logic were
-- saved as 'active' even when the plan is free. Flip those to 'trialing'.
-- Uses the EFFECTIVE price (per-membership override wins) so a custom_price_cents
-- of 0 on a paid plan is still treated as free, and a genuinely paid membership
-- on a $0 plan (custom price > 0) stays active.
update public.memberships m
set status = 'trialing'
from public.membership_plans p
where m.plan_id = p.id
  and m.status = 'active'
  and coalesce(m.custom_price_cents, p.price_cents) = 0;
