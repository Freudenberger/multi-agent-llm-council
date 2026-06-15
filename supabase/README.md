# Supabase setup

How to point this app at a fresh Supabase project from scratch.

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick a name, a strong database password, and a region. Wait for it to provision.

## 2. Create the tables

Open **SQL Editor → New query**, paste the contents of [`schema.sql`](./schema.sql),
and **Run**. This creates the `users` and `conversations` tables (idempotent — safe
to re-run).

## 3. Get your credentials

In **Project Settings → API**:

- **Project URL** → `SUPABASE_URL`
- **`service_role` secret key** → `SUPABASE_SERVICE_ROLE_KEY`
  (use `service_role`, **not** `anon`; the server holds this key and it bypasses RLS)

## 4. Configure the app

In `.env`:

```dotenv
DB_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your_service_role_key
```

The client library is already a dependency. If it ever goes missing:

```bash
npm install @supabase/supabase-js
```

## 5. Run

```bash
npm run dev
```

Register a new account — it should appear in the `users` table (Supabase →
**Table Editor → users**). Conversations land in `conversations`.

## Notes

- `DB_PROVIDER` switches **both** users and conversations between local JSON
  (`local`, the default) and Supabase (`supabase`). See
  [`src/auth/userStorage.ts`](../src/auth/userStorage.ts) and
  [`src/storage/index.ts`](../src/storage/index.ts).
- RLS is enabled with no policies. The app connects with the service-role key
  (server-side only), which bypasses RLS, so this is just a safety default that
  blocks the public anon/auth keys.
- Existing local users in `data/users.json` do **not** migrate automatically —
  re-register, or write a one-off script to copy them into the `users` table.
- Missing credentials degrade reads to empty results but make writes
  (registration, settings updates) throw `Supabase client not available`.
