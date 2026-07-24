-- ======================================================================
--  RADIX Talent Match — Supabase schema, RLS, storage & seed
--  HOW TO USE: Supabase Studio -> SQL Editor -> New query -> paste ALL of
--  this -> Run. Safe to re-run (idempotent).
-- ======================================================================

-- ---------- role enum ----------
do $$ begin
  create type user_role as enum ('candidate','employer','admin');
exception when duplicate_object then null; end $$;

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       user_role not null default 'candidate',
  company_id uuid,
  created_at timestamptz default now()
);

-- ---------- companies ----------
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  aliases    text[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ---------- company_skillsets (the Talent Check bar; 12 rows/company) ----------
create table if not exists public.company_skillsets (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  category_code  text not null,
  required_level int  not null check (required_level between 0 and 10),
  unique (company_id, category_code)
);

do $$ begin
  alter table public.profiles
    add constraint profiles_company_fk
    foreign key (company_id) references public.companies(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------- jds (parsed job descriptions) ----------
create table if not exists public.jds (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete set null,
  company_name text,
  role         text,
  source_file  text,
  storage_path text,
  raw_text     text,
  skills       jsonb not null default '[]',
  uploaded_by  uuid references auth.users(id),
  created_at   timestamptz default now()
);

-- ---------- candidate_profiles (Profile Builder output) ----------
create table if not exists public.candidate_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  name            text,
  email           text,
  education       text,
  skills          jsonb not null default '[]',
  hackathons      jsonb not null default '[]',
  internships     jsonb not null default '[]',
  certifications  jsonb not null default '[]',
  preferred_roles jsonb not null default '[]',
  cv_file         text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ---------- talent_checks (history) ----------
create table if not exists public.talent_checks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  company_name   text,
  readiness_score int,
  skillset_gap   jsonb not null default '[]',
  created_at     timestamptz default now()
);

-- ---------- skill_matches (history) ----------
create table if not exists public.skill_matches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  jd_id          uuid references public.jds(id) on delete set null,
  jd_source_file text,
  match_score    int,
  matched_skills jsonb not null default '[]',
  missing_skills jsonb not null default '[]',
  created_at     timestamptz default now()
);

-- ======================================================================
--  helper functions (SECURITY DEFINER to avoid RLS recursion on profiles)
-- ======================================================================
create or replace function public.app_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- ======================================================================
--  auto-create a profile row when a user signs up
--  (the React app passes {full_name, role} in signUp options.data)
-- ======================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'candidate')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ======================================================================
--  Row-Level Security
-- ======================================================================
alter table public.profiles          enable row level security;
alter table public.companies         enable row level security;
alter table public.company_skillsets enable row level security;
alter table public.jds               enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.talent_checks     enable row level security;
alter table public.skill_matches     enable row level security;

-- profiles ------------------------------------------------------------
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- companies -----------------------------------------------------------
drop policy if exists "companies read"   on public.companies;
drop policy if exists "companies insert" on public.companies;
drop policy if exists "companies update" on public.companies;
drop policy if exists "companies delete" on public.companies;
create policy "companies read"   on public.companies for select using (auth.role() = 'authenticated');
create policy "companies insert" on public.companies for insert with check (public.app_role() in ('employer','admin'));
create policy "companies update" on public.companies for update using (public.is_admin() or created_by = auth.uid());
create policy "companies delete" on public.companies for delete using (public.is_admin());

-- company_skillsets ---------------------------------------------------
drop policy if exists "skillsets read"  on public.company_skillsets;
drop policy if exists "skillsets write" on public.company_skillsets;
create policy "skillsets read"  on public.company_skillsets for select using (auth.role() = 'authenticated');
create policy "skillsets write" on public.company_skillsets for all using (public.is_admin()) with check (public.is_admin());

-- jds -----------------------------------------------------------------
drop policy if exists "jds read"   on public.jds;
drop policy if exists "jds insert" on public.jds;
drop policy if exists "jds update" on public.jds;
drop policy if exists "jds delete" on public.jds;
create policy "jds read"   on public.jds for select using (auth.role() = 'authenticated');
create policy "jds insert" on public.jds for insert with check (public.app_role() in ('employer','admin'));
create policy "jds update" on public.jds for update using (uploaded_by = auth.uid() or public.is_admin());
create policy "jds delete" on public.jds for delete using (uploaded_by = auth.uid() or public.is_admin());

-- candidate_profiles --------------------------------------------------
drop policy if exists "cprofiles read"   on public.candidate_profiles;
drop policy if exists "cprofiles insert" on public.candidate_profiles;
drop policy if exists "cprofiles update" on public.candidate_profiles;
drop policy if exists "cprofiles delete" on public.candidate_profiles;
create policy "cprofiles read"   on public.candidate_profiles for select using (user_id = auth.uid() or public.app_role() in ('employer','admin'));
create policy "cprofiles insert" on public.candidate_profiles for insert with check (user_id = auth.uid());
create policy "cprofiles update" on public.candidate_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cprofiles delete" on public.candidate_profiles for delete using (user_id = auth.uid() or public.is_admin());

-- talent_checks / skill_matches (owner + admin read) ------------------
drop policy if exists "tc all" on public.talent_checks;
drop policy if exists "sm all" on public.skill_matches;
create policy "tc all" on public.talent_checks for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());
create policy "sm all" on public.skill_matches for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());

-- ======================================================================
--  Storage buckets + policies (resumes, jds)
-- ======================================================================
insert into storage.buckets (id, name, public) values
  ('resumes','resumes', false),
  ('jds','jds', false)
on conflict (id) do nothing;

drop policy if exists "bucket read"   on storage.objects;
drop policy if exists "bucket insert" on storage.objects;
drop policy if exists "bucket update" on storage.objects;
drop policy if exists "bucket delete" on storage.objects;
create policy "bucket read"   on storage.objects for select using (bucket_id in ('resumes','jds') and auth.role() = 'authenticated');
create policy "bucket insert" on storage.objects for insert with check (bucket_id in ('resumes','jds') and auth.role() = 'authenticated');
create policy "bucket update" on storage.objects for update using (bucket_id in ('resumes','jds') and auth.role() = 'authenticated');
create policy "bucket delete" on storage.objects for delete using (bucket_id in ('resumes','jds') and auth.role() = 'authenticated');

-- ======================================================================
--  Seed the 3 companies + their 12-skillset bars
-- ======================================================================
insert into public.companies (name, aliases) values
  ('Google LLC',                          array['google','google llc','google inc']),
  ('Microsoft',                           array['microsoft','microsoft corporation','msft']),
  ('Oracle Financial Services Software',  array['oracle','oracle financial services software','ofss','oracle fss'])
on conflict (name) do nothing;

insert into public.company_skillsets (company_id, category_code, required_level)
select c.id, x.code, x.lvl
from public.companies c
join (values
  ('Google LLC','COD',9),('Google LLC','DSA',10),('Google LLC','OOD',8),('Google LLC','APTI',8),
  ('Google LLC','COMM',8),('Google LLC','AI',8),('Google LLC','CLOUD',8),('Google LLC','SQL',7),
  ('Google LLC','SWE',9),('Google LLC','SYSD',9),('Google LLC','NETW',7),('Google LLC','OS',8),
  ('Microsoft','COD',8),('Microsoft','DSA',8),('Microsoft','OOD',8),('Microsoft','APTI',7),
  ('Microsoft','COMM',8),('Microsoft','AI',8),('Microsoft','CLOUD',9),('Microsoft','SQL',8),
  ('Microsoft','SWE',9),('Microsoft','SYSD',8),('Microsoft','NETW',7),('Microsoft','OS',7),
  ('Oracle Financial Services Software','COD',7),('Oracle Financial Services Software','DSA',6),
  ('Oracle Financial Services Software','OOD',7),('Oracle Financial Services Software','APTI',6),
  ('Oracle Financial Services Software','COMM',8),('Oracle Financial Services Software','AI',5),
  ('Oracle Financial Services Software','CLOUD',6),('Oracle Financial Services Software','SQL',9),
  ('Oracle Financial Services Software','SWE',8),('Oracle Financial Services Software','SYSD',6),
  ('Oracle Financial Services Software','NETW',7),('Oracle Financial Services Software','OS',7)
) as x(cname, code, lvl) on x.cname = c.name
on conflict (company_id, category_code) do update set required_level = excluded.required_level;

-- ======================================================================
--  DONE. Next step: sign up in the app, then make yourself admin:
--    update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
-- ======================================================================
