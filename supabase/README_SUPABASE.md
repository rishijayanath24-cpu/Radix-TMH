# Supabase setup (≈10 minutes)

You do this once. It creates the database, security rules, file storage, and
seeds the 3 companies + their skillset bars.

## 1. Create the project
1. Go to https://supabase.com → sign in → **New project**.
2. Name it `radix-talent-match`, pick a region close to you, set a DB password
   (save it somewhere), click **Create**. Wait ~2 min for it to provision.

## 2. Run the schema
1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/migration.sql` from this repo, copy **everything**, paste, **Run**.
3. You should see "Success. No rows returned." That's expected.
   - Verify: **Table Editor** should now list `profiles`, `companies`,
     `company_skillsets` (36 rows), `jds`, `candidate_profiles`, etc.
   - **Storage** should show two buckets: `resumes` and `jds`.

## 3. Grab your keys
Left sidebar → **Project Settings** → **API**. Copy these two values:
- **Project URL**  → e.g. `https://abcdxyz.supabase.co`
- **anon public** key (a long JWT starting with `eyJ...`)

> The `anon` key is safe to use in the browser — RLS protects the data.
> Do NOT put the `service_role` key in the frontend.

## 4. Put the keys where they belong
Create **`frontend/.env`** (I'll scaffold the frontend; this file is gitignored):
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
VITE_API_URL=http://127.0.0.1:8099
```
(The Python backend does **not** need Supabase keys — it's a stateless
compute service. Leave `SUPABASE_*` blank in `backend/.env`.)

## 5. Make yourself admin
After you sign up in the app the first time, come back to **SQL Editor** and run:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Roles at a glance
| Role | Can do |
|------|--------|
| `candidate` | upload resume, build profile, run Talent Check + Skill Match, see own history |
| `employer`  | create/manage a company, upload JDs, browse candidate profiles |
| `admin`     | manage companies + skillset bars, see all users / JDs / profiles |

New sign-ups default to `candidate`. The signup screen lets a user choose
"Find a job" (candidate) or "Hire" (employer); admin is granted via the SQL above.
