/*
  # PitchIQ Core Schema

  1. New Tables
    - `companies` — tenant companies
    - `profiles` — app-level user data extending auth.users

  2. Security
    - RLS enabled on both tables with least-privilege policies

  3. Notes
    - Self-referential manager_id FK added after table creation
    - Trigger auto-creates a profile row when a new auth user is inserted
*/

-- ── Companies ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text UNIQUE NOT NULL,
  default_framework text NOT NULL DEFAULT 'MEDDIC',
  pass_threshold   int NOT NULL DEFAULT 70,
  is_active        boolean NOT NULL DEFAULT true,
  industry         text,
  contact_email    text,
  contact_phone    text,
  max_agents       int,
  registration_info text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ── Profiles ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text NOT NULL,
  first_name     text NOT NULL DEFAULT '',
  last_name      text NOT NULL DEFAULT '',
  role           text NOT NULL DEFAULT 'AGENT',
  company_id     uuid REFERENCES companies(id),
  manager_id     uuid,
  is_active      boolean NOT NULL DEFAULT true,
  avatar_url     text,
  location       text,
  region         text,
  team           text,
  territory      text,
  zone           text,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Add self-referential FK after table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_manager_id_fkey'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES profiles(id);
  END IF;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── RLS: companies ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can read own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Super admins read all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  );

-- ── RLS: profiles ──────────────────────────────────────────────────────────────
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins and managers read company profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role IN ('COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Super admins read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'SUPER_ADMIN')
  );

-- ── Trigger: auto-create profile on sign-up ────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'AGENT'),
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
