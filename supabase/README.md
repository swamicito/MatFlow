# Supabase

This folder contains MatFlow's database schema and Supabase CLI config.

## Option A — Cloud project (recommended for quick start)

1. Create a project at https://supabase.com/dashboard.
2. Copy `Project URL` and `anon public` key from **Project Settings → API** into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # optional, server-only
   ```
3. Apply the schema. Either:
   - Open **SQL Editor** in the dashboard, paste the contents of `migrations/0001_init.sql`, and run; **or**
   - Link the CLI and push:
     ```bash
     npx supabase link --project-ref <YOUR-REF>
     npx supabase db push
     ```
4. Regenerate types:
   ```bash
   npm run db:types
   ```

## Option B — Local stack via Supabase CLI

```bash
npx supabase start            # boots local Postgres + Studio + Auth on :54321/:54323
npx supabase db reset         # applies migrations/*.sql to the local DB
npm run db:types:local
```

Local credentials are printed by `supabase start` — copy the API URL and anon key
into `.env.local`.

## Migrations

- `migrations/0001_init.sql` — gyms, profiles, leads, students, memberships,
  attendance, belt_progress, family_accounts, waivers, plus enums, indexes,
  the `user_gym_id()` helper, an `auth.users` insert trigger that auto-creates
  a profile, and Row Level Security policies that restrict each row to the
  authenticated user's gym.
