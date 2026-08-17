-- Add 'pending' to membership_status: subscription created but the first
-- invoice hasn't been paid yet. invoice.paid flips it to 'active'.
alter type public.membership_status add value if not exists 'pending';
