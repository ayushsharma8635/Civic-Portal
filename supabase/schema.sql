-- ==============================================================================
-- Civic Portal - Supabase Complete Database Schema & Security
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'officer', 'admin')),
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Database-level security function to check if the current user is the single authorized administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) = 'ayushsharma8635@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Database-level security trigger: Strictly guarantees only the designated admin email can hold the 'admin' role
CREATE OR REPLACE FUNCTION public.enforce_single_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Revert any unauthorized attempt to set role='admin' back to 'citizen'
  IF NEW.role = 'admin' AND LOWER(TRIM(COALESCE(NEW.email, ''))) NOT IN ('ayushsharma8635@gmail.com') THEN
    NEW.role := 'citizen';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_admin_role ON public.profiles;
CREATE TRIGGER trg_enforce_admin_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_admin_role();

DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Database-level trigger to automatically provision profiles on new auth.users signup (Google OAuth or email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'citizen';
  v_name TEXT := '';
  v_avatar TEXT := '';
BEGIN
  -- Strict single-admin check: only the designated email can ever hold the 'admin' role
  IF LOWER(TRIM(COALESCE(NEW.email, ''))) = 'ayushsharma8635@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'citizen';
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1)
  );
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  INSERT INTO public.profiles (id, email, full_name, role, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role,
    NULLIF(v_avatar, ''),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    avatar_url = COALESCE(NULLIF(public.profiles.avatar_url, ''), EXCLUDED.avatar_url),
    role = CASE
      WHEN LOWER(TRIM(COALESCE(NEW.email, ''))) = 'ayushsharma8635@gmail.com' THEN 'admin'
      ELSE 'citizen'
    END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. DEPARTMENTS TABLE (UUID Primary Key)
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  head TEXT,
  email TEXT,
  phone TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Departments are viewable by anyone" ON public.departments;
CREATE POLICY "Departments are viewable by anyone"
  ON public.departments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Departments are editable by authenticated users" ON public.departments;
CREATE POLICY "Departments are editable by authenticated users"
  ON public.departments FOR ALL
  TO authenticated
  USING (true);

-- 3. AREAS TABLE (UUID Primary Key)
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  city TEXT DEFAULT 'Kanpur',
  ward TEXT,
  district TEXT DEFAULT 'Kanpur Nagar',
  landmark TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  active BOOLEAN NOT NULL DEFAULT true,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Areas are viewable by anyone" ON public.areas;
CREATE POLICY "Areas are viewable by anyone"
  ON public.areas FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Areas can be managed by authenticated users" ON public.areas;
CREATE POLICY "Areas can be managed by authenticated users"
  ON public.areas FOR ALL
  TO authenticated
  USING (true);

-- 4. OFFICERS TABLE (UUID Primary Key and UUID Foreign Keys)
CREATE TABLE IF NOT EXISTS public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  email TEXT,
  mobile TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  department TEXT,
  area_name TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  designation TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Officers viewable by authenticated users" ON public.officers;
CREATE POLICY "Officers viewable by authenticated users"
  ON public.officers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Officers manageable by authenticated users" ON public.officers;
CREATE POLICY "Officers manageable by authenticated users"
  ON public.officers FOR ALL
  TO authenticated
  USING (true);

-- 5. COMPLAINTS TABLE (UUID Primary Key, UUID Foreign Keys)
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  department TEXT,
  area_name TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  landmark TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Pending', 'In Review', 'Assigned', 'Accepted', 'Work Started', 'In Progress', 'Work Completed', 'Resolved', 'Rejected')),
  is_spam BOOLEAN NOT NULL DEFAULT false,
  duplicate_of TEXT,
  ai_summary TEXT,
  remarks TEXT,
  officer_id UUID REFERENCES public.officers(id) ON DELETE SET NULL,
  officer_name TEXT,
  created_by_id UUID,
  citizen_name TEXT,
  citizen_email TEXT,
  citizen_phone TEXT,
  estimated_days INTEGER,
  expected_date TIMESTAMPTZ,
  is_delayed BOOLEAN DEFAULT false,
  temporary_solution TEXT,
  temp_alt_route TEXT,
  temp_alt_facility TEXT,
  temp_availability_time TEXT,
  temp_contact TEXT,
  timeline JSONB DEFAULT '[]'::jsonb,
  actual_resolved_date TIMESTAMPTZ,
  location TEXT,
  area TEXT,
  location_name TEXT,
  formatted_address TEXT,
  google_place_id TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Complaints are viewable by all" ON public.complaints;
CREATE POLICY "Complaints are viewable by all"
  ON public.complaints FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can create complaints" ON public.complaints;
CREATE POLICY "Anyone can create complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authorized updates to complaints" ON public.complaints;
CREATE POLICY "Authorized updates to complaints"
  ON public.complaints FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Only authorized admin can delete complaints" ON public.complaints;
CREATE POLICY "Only authorized admin can delete complaints"
  ON public.complaints FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 6. COMPLAINT MEDIA TABLE (UUID Primary Key, UUID Foreign Key)
CREATE TABLE IF NOT EXISTS public.complaint_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  phase TEXT DEFAULT 'during' CHECK (phase IN ('before', 'during', 'after')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  media_type TEXT DEFAULT 'photo',
  uploaded_by TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.complaint_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Complaint media viewable by all" ON public.complaint_media;
CREATE POLICY "Complaint media viewable by all"
  ON public.complaint_media FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Complaint media insertable by anyone" ON public.complaint_media;
CREATE POLICY "Complaint media insertable by anyone"
  ON public.complaint_media FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Complaint media deletable by authenticated users" ON public.complaint_media;
CREATE POLICY "Complaint media deletable by authenticated users"
  ON public.complaint_media FOR DELETE
  TO authenticated
  USING (true);

-- 7. NOTIFICATIONS TABLE (UUID Primary Key)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'status_update',
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications viewable by anyone" ON public.notifications;
CREATE POLICY "Notifications viewable by anyone"
  ON public.notifications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Notifications insertable by anyone" ON public.notifications;
CREATE POLICY "Notifications insertable by anyone"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Notifications updatable by anyone" ON public.notifications;
CREATE POLICY "Notifications updatable by anyone"
  ON public.notifications FOR UPDATE
  USING (true);

-- 8. ACTIVITY LOGS TABLE (UUID Primary Key)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity logs viewable by authenticated users" ON public.activity_logs;
CREATE POLICY "Activity logs viewable by authenticated users"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Activity logs insertable by anyone" ON public.activity_logs;
CREATE POLICY "Activity logs insertable by anyone"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- 9. OFFICER ACTIVITY LOGS TABLE (UUID Primary Key, UUID Foreign Keys)
CREATE TABLE IF NOT EXISTS public.officer_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID REFERENCES public.officers(id) ON DELETE SET NULL,
  officer_name TEXT,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  complaint_title TEXT,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  remarks TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.officer_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Officer activity logs viewable by anyone" ON public.officer_activity_logs;
CREATE POLICY "Officer activity logs viewable by anyone"
  ON public.officer_activity_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Officer activity logs insertable by anyone" ON public.officer_activity_logs;
CREATE POLICY "Officer activity logs insertable by anyone"
  ON public.officer_activity_logs FOR INSERT
  WITH CHECK (true);

-- 10. FEEDBACK TABLE (UUID Primary Key, UUID Foreign Key)
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Feedback viewable by anyone" ON public.feedback;
CREATE POLICY "Feedback viewable by anyone"
  ON public.feedback FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Feedback insertable by anyone" ON public.feedback;
CREATE POLICY "Feedback insertable by anyone"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
SELECT 'complaint-media', 'complaint-media', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'complaint-media'
);

DROP POLICY IF EXISTS "Allow public read access on complaint-media" ON storage.objects;
CREATE POLICY "Allow public read access on complaint-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'complaint-media');

DROP POLICY IF EXISTS "Allow upload access on complaint-media" ON storage.objects;
CREATE POLICY "Allow upload access on complaint-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'complaint-media');

-- ==============================================================================
-- SAFE CONSTRAINT SYNCHRONIZATION (For existing pre-migrated databases)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.departments'::regclass AND conname = 'departments_name_key'
  ) THEN
    BEGIN
      ALTER TABLE public.departments ADD CONSTRAINT departments_name_key UNIQUE (name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.areas'::regclass AND conname = 'areas_name_key'
  ) THEN
    BEGIN
      ALTER TABLE public.areas ADD CONSTRAINT areas_name_key UNIQUE (name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.officers'::regclass AND conname = 'officers_username_key'
  ) THEN
    BEGIN
      ALTER TABLE public.officers ADD CONSTRAINT officers_username_key UNIQUE (username);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Safe column synchronization: ensure all columns exist on existing tables
  -- Complaints
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS citizen_name TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS citizen_email TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS citizen_phone TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS area_name TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS landmark TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS location TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS area TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS location_name TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS formatted_address TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS google_place_id TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS estimated_days INTEGER;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS expected_date TIMESTAMPTZ;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_delayed BOOLEAN DEFAULT false;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS temporary_solution TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS temp_alt_route TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS temp_alt_facility TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS temp_availability_time TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS temp_contact TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS actual_resolved_date TIMESTAMPTZ;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS ai_summary TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS remarks TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS duplicate_of TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS officer_name TEXT;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS officer_id UUID REFERENCES public.officers(id) ON DELETE SET NULL;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS created_by_id UUID;
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

  -- Update status check constraint on complaints to allow all valid statuses
  BEGIN
    ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
    ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check 
      CHECK (status IN ('Submitted', 'Pending', 'In Review', 'Assigned', 'Accepted', 'Work Started', 'In Progress', 'Work Completed', 'Resolved', 'Rejected'));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Update media phase check constraint to include citizen uploads
  BEGIN
    ALTER TABLE public.complaint_media DROP CONSTRAINT IF EXISTS complaint_media_phase_check;
    ALTER TABLE public.complaint_media ADD CONSTRAINT complaint_media_phase_check 
      CHECK (phase IN ('citizen', 'before', 'during', 'after'));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Departments
  ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

  -- Areas
  ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

  -- Officers
  ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS profile_photo TEXT;
  ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS area_name TEXT;
  ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

  -- Profiles
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

  -- Complaint Media
  ALTER TABLE public.complaint_media ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.complaint_media ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.complaint_media ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

  -- Notifications
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

  -- Backfill and synchronize existing rows for timestamps and read status
  UPDATE public.departments SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now()), updated_at = COALESCE(updated_at, created_date, created_at, now());
  UPDATE public.areas SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now()), updated_at = COALESCE(updated_at, created_date, created_at, now());
  UPDATE public.officers SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now()), updated_at = COALESCE(updated_at, created_date, created_at, now());
  UPDATE public.complaint_media SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now()), updated_at = COALESCE(updated_at, created_date, created_at, now());
  UPDATE public.notifications SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now()), updated_at = COALESCE(updated_at, created_date, created_at, now()), read = COALESCE(read, is_read, false), is_read = COALESCE(is_read, read, false);
  UPDATE public.complaints SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now()), updated_at = COALESCE(updated_at, created_date, created_at, now());
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- ==============================================================================
-- INITIAL SEED DATA (Valid UUIDs, foolproof insertion via WHERE NOT EXISTS)
-- ==============================================================================
-- 1. Departments: insert missing seed records
INSERT INTO public.departments (id, name, description, head, email, phone)
SELECT v.id::uuid, v.name, v.description, v.head, v.email, v.phone
FROM (VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Public Works Department (PWD)', 'Road repairs, potholes, sidewalks', 'Er. R. K. Verma', 'pwd.kanpur@nic.in', '+91 512 2548901'),
  ('a0000000-0000-0000-0000-000000000002', 'Jal Sansthan (Water & Drainage)', 'Water supply lines, sewage overflows', 'Smt. Anjali Srivastava', 'jalsansthan.kanpur@nic.in', '+91 512 2543412'),
  ('a0000000-0000-0000-0000-000000000003', 'KESCO (Electricity & Street Lighting)', 'Street lights, cables, transformers', 'Er. S. N. Mishra', 'kesco.grievance@nic.in', '+91 512 2556789'),
  ('a0000000-0000-0000-0000-000000000004', 'Solid Waste & Sanitation (Nagar Nigam)', 'Garbage collection, illegal dumping', 'Dr. Alok Pandey', 'sanitation.knn@nic.in', '+91 512 2534567'),
  ('a0000000-0000-0000-0000-000000000005', 'Health & Vector Control', 'Mosquito fogging, stray animals', 'Dr. Meena Gupta', 'health.knn@nic.in', '+91 512 2534890'),
  ('a0000000-0000-0000-0000-000000000006', 'Traffic & Public Safety', 'Traffic signals, illegal parking', 'Inspector Rajesh Kumar', 'traffic.kanpur@uppolice.gov.in', '+91 512 2304100')
) AS v(id, name, description, head, email, phone)
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments d WHERE d.id = v.id::uuid OR LOWER(d.name) = LOWER(v.name)
);

-- Update department metadata if records already existed
UPDATE public.departments AS d
SET
  description = COALESCE(d.description, v.description),
  head = COALESCE(d.head, v.head),
  email = COALESCE(d.email, v.email),
  phone = COALESCE(d.phone, v.phone)
FROM (VALUES
  ('Public Works Department (PWD)', 'Road repairs, potholes, sidewalks', 'Er. R. K. Verma', 'pwd.kanpur@nic.in', '+91 512 2548901'),
  ('Jal Sansthan (Water & Drainage)', 'Water supply lines, sewage overflows', 'Smt. Anjali Srivastava', 'jalsansthan.kanpur@nic.in', '+91 512 2543412'),
  ('KESCO (Electricity & Street Lighting)', 'Street lights, cables, transformers', 'Er. S. N. Mishra', 'kesco.grievance@nic.in', '+91 512 2556789'),
  ('Solid Waste & Sanitation (Nagar Nigam)', 'Garbage collection, illegal dumping', 'Dr. Alok Pandey', 'sanitation.knn@nic.in', '+91 512 2534567'),
  ('Health & Vector Control', 'Mosquito fogging, stray animals', 'Dr. Meena Gupta', 'health.knn@nic.in', '+91 512 2534890'),
  ('Traffic & Public Safety', 'Traffic signals, illegal parking', 'Inspector Rajesh Kumar', 'traffic.kanpur@uppolice.gov.in', '+91 512 2304100')
) AS v(name, description, head, email, phone)
WHERE LOWER(d.name) = LOWER(v.name);

-- 2. Areas: insert seed records (61 Kanpur municipal wards & areas)
INSERT INTO public.areas (id, name, city, ward, district, landmark, latitude, longitude, active)
SELECT v.id::uuid, v.name, v.city, v.ward, v.district, v.landmark, v.latitude, v.longitude, v.active
FROM (VALUES
  ('d5151169-aa65-4415-a0e0-6acd240c3211', 'Anwar Ganj', 'Kanpur', 'Ward 56', 'Kanpur Nagar', 'Anwar Ganj Railway Station', 26.4507, 80.3425, true),
  ('be45eda3-b526-47ca-9e46-1b1d6119022c', 'Baboo Purwa', 'Kanpur', 'Ward 105', 'Kanpur Nagar', 'Baboo Purwa Chauraha', 26.42, 80.348, true),
  ('e64162b7-9ab8-4d6c-ae7c-33b1634ec7fb', 'Babu Purwa Colony', 'Kanpur', 'Ward 80', 'Kanpur Nagar', 'Babu Purwa Chauraha', 26.426, 80.343, true),
  ('6c1107ae-a2e8-498a-8661-dd95f4f99097', 'Barra', 'Kanpur', 'Ward 71', 'Kanpur Nagar', 'Barra 2 Bypass', 26.4215, 80.2954, true),
  ('eee6a074-94f3-4694-bdcb-0cdf23c632fe', 'Basant Vihar', 'Kanpur', 'Ward 88', 'Kanpur Nagar', 'Basant Vihar', 26.405, 80.34, true),
  ('f7e96c01-f97c-448f-9894-a8821d41eef3', 'Becon Ganj', 'Kanpur', 'Ward 97', 'Kanpur Nagar', 'Becon Ganj Chauraha', 26.46, 80.33, true),
  ('a8efdf8b-3e27-4215-b3f7-ddc548515257', 'Begam Purwa', 'Kanpur', 'Ward 102', 'Kanpur Nagar', 'Begam Purwa Chauraha', 26.425, 80.35, true),
  ('30addb57-2b7c-47a3-bacb-3ec8a1f8cde7', 'Bingawan', 'Kanpur', 'Ward 87', 'Kanpur Nagar', 'Bingawan Chauraha', 26.394, 80.335, true),
  ('913e18fa-cdf3-40fc-8e5f-1778a9f1fd02', 'Chakeri', 'Kanpur', 'Ward 12', 'Kanpur Nagar', 'Chakeri Railway Station', 26.415, 80.41, true),
  ('655e2657-4baf-4cf7-8c49-60f862cf4554', 'Chaman Ganj', 'Kanpur', 'Ward 107', 'Kanpur Nagar', 'Chaman Ganj Chauraha', 26.4675, 80.3395, true),
  ('8e7f6794-cac5-4774-839b-0bfdf6fc5ef0', 'Chandari', 'Kanpur', 'Ward 99', 'Kanpur Nagar', 'Chandari Railway Station', 26.414, 80.425, true),
  ('260dfa74-9306-4d99-8d84-7e3d1d4db5da', 'Chowk Sarrafa', 'Kanpur', 'Ward 101', 'Kanpur Nagar', 'Chowk Sarrafa', 26.4605, 80.35, true),
  ('bbec0374-f00f-4dc7-8ca8-0f561e235bc1', 'Chunni Ganj', 'Kanpur', 'Ward 3', 'Kanpur Nagar', 'Chunni Ganj Chauraha', 26.475, 80.337, true),
  ('93d6f528-5327-427a-90e8-174904f07814', 'Civil Lines', 'Kanpur', 'Ward 15', 'Kanpur Nagar', 'Opposite Green Park Stadium', 26.4729, 80.3444, true),
  ('b6ded66d-58e0-44aa-a8a6-81c85cf46836', 'Collector Ganj', 'Kanpur', 'Ward 106', 'Kanpur Nagar', 'Collector Ganj', 26.462, 80.343, true),
  ('d1fd7f0f-dfe6-4b21-bb38-0b5d30050c0a', 'Colonel Ganj', 'Kanpur', 'Ward 110', 'Kanpur Nagar', 'Colonel Ganj Chauraha', 26.472, 80.35, true),
  ('47e22c20-6039-402a-bd3b-066354cfdaf3', 'Cooper Ganj', 'Kanpur', 'Ward 89', 'Kanpur Nagar', 'Cooper Ganj Chauraha', 26.4515, 80.341, true),
  ('50b648dd-f38f-4797-b87d-57767a343803', 'Daheli Sujanpur KDA Colony', 'Kanpur', 'Ward 47', 'Kanpur Nagar', 'KDA Colony', 26.427, 80.38, true),
  ('cf795277-ad94-4ca3-af25-53f01553f7fa', 'Danakhori', 'Kanpur', 'Ward 90', 'Kanpur Nagar', 'Danakhori Chauraha', 26.449, 80.3475, true),
  ('975f37d9-7780-4da4-b1f6-09d4a658fe0e', 'Gandhi Nagar', 'Kanpur', 'Ward 6', 'Kanpur Nagar', 'Gandhi Nagar Chauraha', 26.474, 80.326, true),
  ('7cb2e736-3262-4d68-80c9-4740ee0bb8c9', 'General Ganj', 'Kanpur', 'Ward 104', 'Kanpur Nagar', 'General Ganj Chauraha', 26.464, 80.345, true),
  ('f1ba23c8-f52b-470c-927f-765bc8522014', 'Govind Nagar', 'Kanpur', 'Ward 54', 'Kanpur Nagar', 'C-Block Market', 26.4432, 80.3015, true),
  ('4de8d394-d781-4e40-8980-925be47ea870', 'Gumti No. 5', 'Kanpur', 'Ward 28', 'Kanpur Nagar', 'Gumti Central Market', 26.4712, 80.3156, true),
  ('43ed9bc0-63c4-4a5d-afb8-72451deb0b6b', 'Gwaltoli', 'Kanpur', 'Ward 4', 'Kanpur Nagar', 'Gwaltoli Chauraha', 26.48, 80.342, true),
  ('eaf37c91-25c2-4fa0-a83a-8dd0d41d3242', 'Hans Puram', 'Kanpur', 'Ward 41', 'Kanpur Nagar', 'Hans Puram Chauraha', 26.4005, 80.365, true),
  ('a244ec07-e39a-44ae-8263-bb2cd230db8a', 'Hans Puram Awas Vikas', 'Kanpur', 'Ward 22', 'Kanpur Nagar', 'Awas Vikas Hans Puram', 26.405, 80.36, true),
  ('3508a7f5-9dfd-495b-89c5-5d66211d4049', 'Jajmau North', 'Kanpur', 'Ward 96', 'Kanpur Nagar', 'Jajmau Bridge', 26.438, 80.408, true),
  ('41ead400-0b75-45d9-b0fa-c8d50e809768', 'Jajmau South', 'Kanpur', 'Ward 73', 'Kanpur Nagar', 'Jajmau Chauraha', 26.43, 80.405, true),
  ('f7b72fcc-2cea-4592-a453-944739fef10c', 'Jarauli', 'Kanpur', 'Ward 82', 'Kanpur Nagar', 'Jarauli Chauraha', 26.405, 80.345, true),
  ('a40ac6f2-50be-4e9a-b1f0-dce7e8c9e1af', 'Jawahar Nagar', 'Kanpur', 'Ward 5', 'Kanpur Nagar', 'Jawahar Nagar Chauraha', 26.478, 80.33, true),
  ('02c79b7b-6640-4c6d-9535-02b6b9f12420', 'Juhi Kala', 'Kanpur', 'Ward 84', 'Kanpur Nagar', 'Juhi Kala Chauraha', 26.424, 80.335, true),
  ('a3a08823-6bb2-4c8f-9966-b7cd6bcd5542', 'Kakadeo', 'Kanpur', 'Ward 42', 'Kanpur Nagar', 'Deoki Cinema Crossing', 26.4789, 80.2974, true),
  ('9a5751c2-ac09-41d8-add9-e66e2f96d54e', 'Kalyanpur', 'Kanpur', 'Ward 38', 'Kanpur Nagar', 'Near Kalyanpur Railway Crossing', 26.4927, 80.2589, true),
  ('14d0c5b7-920d-437e-ac72-2fb238db70e9', 'Khandipur', 'Kanpur', 'Ward 21', 'Kanpur Nagar', 'Khandipur Chauraha', 26.43, 80.365, true),
  ('91f79963-95f4-47fa-904c-1a4c8d4053db', 'Khyora', 'Kanpur', 'Ward 44', 'Kanpur Nagar', 'Khyora Chauraha', 26.52, 80.285, true),
  ('1cdec55d-a068-4d88-b8cf-3586ac4c998e', 'Kidwai Nagar', 'Kanpur', 'Ward 62', 'Kanpur Nagar', 'Kidwai Nagar Central Park', 26.4358, 80.3341, true),
  ('39ec1552-2ac5-4128-8f73-eca36d512cc5', 'Kidwai Nagar North', 'Kanpur', 'Ward 100', 'Kanpur Nagar', 'Kidwai Nagar', 26.438, 80.342, true),
  ('bceac16e-51a3-40a2-be2c-76635d974b4e', 'Kidwai Nagar South', 'Kanpur', 'Ward 92', 'Kanpur Nagar', 'Kidwai Nagar', 26.43, 80.34, true),
  ('eb7a1547-9875-47bb-a1c2-dfddd147d166', 'Laxmi Purwa', 'Kanpur', 'Ward 1', 'Kanpur Nagar', 'Laxmi Purwa Chauraha', 26.4542, 80.3378, true),
  ('a1eadd24-319d-46b8-a0d4-c1d102f0ab8e', 'Maheshwari Mohal', 'Kanpur', 'Ward 98', 'Kanpur Nagar', 'Maheshwari Mohal', 26.466, 80.352, true),
  ('daa1a5cb-b53b-4601-b3a7-6077114cc130', 'Naubasta East', 'Kanpur', 'Ward 63', 'Kanpur Nagar', 'Naubasta Chauraha', 26.407, 80.37, true),
  ('60761299-2069-4980-82be-65b797ad42de', 'Nawabganj', 'Kanpur', 'Ward 43', 'Kanpur Nagar', 'Nawabganj Chauraha', 26.505, 80.33, true),
  ('7804b026-2523-4c4e-a6d0-292a1bcecc5c', 'Nazir Bagh', 'Kanpur', 'Ward 109', 'Kanpur Nagar', 'Nazir Bagh', 26.473, 80.341, true),
  ('149b8003-72ae-4f81-8e22-4fa4748b61a3', 'Panki', 'Kanpur', 'Ward 57', 'Kanpur Nagar', 'Panki hanuman Mandir', 26.4499, 80.3319, true),
  ('7b461b6b-2193-48b9-9417-5227fa3c6260', 'Parade', 'Kanpur', 'Ward 10', 'Kanpur Nagar', 'Naveen Market Area', 26.4635, 80.3498, true),
  ('b0d41ad6-3fa1-44fe-9699-60dc89151688', 'Pashupati Nagar', 'Kanpur', 'Ward 66', 'Kanpur Nagar', 'Pashupati Nagar', 26.412, 80.355, true),
  ('ee0500f6-a96a-45aa-ac98-738aa2b832de', 'Patkapur', 'Kanpur', 'Ward 94', 'Kanpur Nagar', 'Patkapur Chauraha', 26.469, 80.354, true),
  ('ee092b20-dbd3-4510-b70e-080328e86aa1', 'Rai Purwa', 'Kanpur', 'Ward 32', 'Kanpur Nagar', 'Rai Purwa Chauraha', 26.4617, 80.337, true),
  ('6777f4ae-9815-4ba9-9ec4-d1bf7b16f9a8', 'Rajeev Nagar Naubasta East', 'Kanpur', 'Ward 68', 'Kanpur Nagar', 'Rajeev Nagar', 26.401, 80.375, true),
  ('552d3575-6758-43e5-ba07-6a932eeb2e3c', 'Safipur', 'Kanpur', 'Ward 11', 'Kanpur Nagar', 'Safipur Chauraha', 26.434, 80.397, true),
  ('e4e404c0-1dd3-4438-87db-d0b70d65f889', 'Shastri Nagar', 'Kanpur', 'Ward 33', 'Kanpur Nagar', 'Near Central Park', 26.4678, 80.3065, true),
  ('4d208a09-f2cf-465f-af3e-213d44a56901', 'Shyam Nagar Sujat Ganj', 'Kanpur', 'Ward 74', 'Kanpur Nagar', 'Shyam Nagar Chauraha', 26.415, 80.39, true),
  ('1e2d901c-b7e8-4577-90bc-44efa35b2bc2', 'Sishamau North', 'Kanpur', 'Ward 59', 'Kanpur Nagar', 'Sishamau Chauraha', 26.48, 80.325, true),
  ('e81efa57-01e3-4d15-98d3-028b6f576c6b', 'Swarda Jayanti Vihar', 'Kanpur', 'Ward 62', 'Kanpur Nagar', 'Swarda Jayanti Vihar', 26.41, 80.385, true),
  ('90558827-d24b-47d1-9007-c9fce7decd03', 'Swaroop Nagar', 'Kanpur', 'Ward 21', 'Kanpur Nagar', 'Near Motijheel Gate', 26.4815, 80.3182, true),
  ('069e454e-4681-42e5-acae-fc7081955651', 'Talak Mohal', 'Kanpur', 'Ward 108', 'Kanpur Nagar', 'Talak Mohal Chauraha', 26.455, 80.355, true),
  ('fb4e126f-a49d-4e4f-aba8-5006b64380d7', 'Tilak Nagar', 'Kanpur', 'Ward 61', 'Kanpur Nagar', 'Tilak Nagar Chauraha', 26.485, 80.315, true),
  ('e6d22b18-9a30-4cfa-bf96-03306096ea82', 'Tiwari Pur', 'Kanpur', 'Ward 58', 'Kanpur Nagar', 'Tiwari Pur Chauraha', 26.435, 80.375, true),
  ('572005db-6614-40d1-b7b4-6ec914c0f6ee', 'Usmanpur', 'Kanpur', 'Ward 18', 'Kanpur Nagar', 'Usmanpur Chauraha', 26.423, 80.35, true),
  ('17c03353-0763-455c-a3fc-cf3ba793fdd0', 'Yashoda Nagar East', 'Kanpur', 'Ward 46', 'Kanpur Nagar', 'Yashoda Nagar Chauraha', 26.421, 80.355, true),
  ('ab46b6fa-66b6-4d7c-bc0c-84562aae4781', 'Yashoda Nagar West', 'Kanpur', 'Ward 95', 'Kanpur Nagar', 'Yashoda Nagar', 26.419, 80.347, true)
) AS v(id, name, city, ward, district, landmark, latitude, longitude, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.areas a WHERE a.id = v.id::uuid OR LOWER(a.name) = LOWER(v.name)
);

-- Update existing areas coordinates & metadata
UPDATE public.areas AS a
SET
  ward = COALESCE(v.ward, a.ward),
  landmark = COALESCE(v.landmark, a.landmark),
  latitude = COALESCE(v.latitude, a.latitude),
  longitude = COALESCE(v.longitude, a.longitude),
  active = true
FROM (VALUES
  ('d5151169-aa65-4415-a0e0-6acd240c3211', 'Anwar Ganj', 'Kanpur', 'Ward 56', 'Kanpur Nagar', 'Anwar Ganj Railway Station', 26.4507, 80.3425, true),
  ('be45eda3-b526-47ca-9e46-1b1d6119022c', 'Baboo Purwa', 'Kanpur', 'Ward 105', 'Kanpur Nagar', 'Baboo Purwa Chauraha', 26.42, 80.348, true),
  ('e64162b7-9ab8-4d6c-ae7c-33b1634ec7fb', 'Babu Purwa Colony', 'Kanpur', 'Ward 80', 'Kanpur Nagar', 'Babu Purwa Chauraha', 26.426, 80.343, true),
  ('6c1107ae-a2e8-498a-8661-dd95f4f99097', 'Barra', 'Kanpur', 'Ward 71', 'Kanpur Nagar', 'Barra 2 Bypass', 26.4215, 80.2954, true),
  ('eee6a074-94f3-4694-bdcb-0cdf23c632fe', 'Basant Vihar', 'Kanpur', 'Ward 88', 'Kanpur Nagar', 'Basant Vihar', 26.405, 80.34, true),
  ('f7e96c01-f97c-448f-9894-a8821d41eef3', 'Becon Ganj', 'Kanpur', 'Ward 97', 'Kanpur Nagar', 'Becon Ganj Chauraha', 26.46, 80.33, true),
  ('a8efdf8b-3e27-4215-b3f7-ddc548515257', 'Begam Purwa', 'Kanpur', 'Ward 102', 'Kanpur Nagar', 'Begam Purwa Chauraha', 26.425, 80.35, true),
  ('30addb57-2b7c-47a3-bacb-3ec8a1f8cde7', 'Bingawan', 'Kanpur', 'Ward 87', 'Kanpur Nagar', 'Bingawan Chauraha', 26.394, 80.335, true),
  ('913e18fa-cdf3-40fc-8e5f-1778a9f1fd02', 'Chakeri', 'Kanpur', 'Ward 12', 'Kanpur Nagar', 'Chakeri Railway Station', 26.415, 80.41, true),
  ('655e2657-4baf-4cf7-8c49-60f862cf4554', 'Chaman Ganj', 'Kanpur', 'Ward 107', 'Kanpur Nagar', 'Chaman Ganj Chauraha', 26.4675, 80.3395, true),
  ('8e7f6794-cac5-4774-839b-0bfdf6fc5ef0', 'Chandari', 'Kanpur', 'Ward 99', 'Kanpur Nagar', 'Chandari Railway Station', 26.414, 80.425, true),
  ('260dfa74-9306-4d99-8d84-7e3d1d4db5da', 'Chowk Sarrafa', 'Kanpur', 'Ward 101', 'Kanpur Nagar', 'Chowk Sarrafa', 26.4605, 80.35, true),
  ('bbec0374-f00f-4dc7-8ca8-0f561e235bc1', 'Chunni Ganj', 'Kanpur', 'Ward 3', 'Kanpur Nagar', 'Chunni Ganj Chauraha', 26.475, 80.337, true),
  ('93d6f528-5327-427a-90e8-174904f07814', 'Civil Lines', 'Kanpur', 'Ward 15', 'Kanpur Nagar', 'Opposite Green Park Stadium', 26.4729, 80.3444, true),
  ('b6ded66d-58e0-44aa-a8a6-81c85cf46836', 'Collector Ganj', 'Kanpur', 'Ward 106', 'Kanpur Nagar', 'Collector Ganj', 26.462, 80.343, true),
  ('d1fd7f0f-dfe6-4b21-bb38-0b5d30050c0a', 'Colonel Ganj', 'Kanpur', 'Ward 110', 'Kanpur Nagar', 'Colonel Ganj Chauraha', 26.472, 80.35, true),
  ('47e22c20-6039-402a-bd3b-066354cfdaf3', 'Cooper Ganj', 'Kanpur', 'Ward 89', 'Kanpur Nagar', 'Cooper Ganj Chauraha', 26.4515, 80.341, true),
  ('50b648dd-f38f-4797-b87d-57767a343803', 'Daheli Sujanpur KDA Colony', 'Kanpur', 'Ward 47', 'Kanpur Nagar', 'KDA Colony', 26.427, 80.38, true),
  ('cf795277-ad94-4ca3-af25-53f01553f7fa', 'Danakhori', 'Kanpur', 'Ward 90', 'Kanpur Nagar', 'Danakhori Chauraha', 26.449, 80.3475, true),
  ('975f37d9-7780-4da4-b1f6-09d4a658fe0e', 'Gandhi Nagar', 'Kanpur', 'Ward 6', 'Kanpur Nagar', 'Gandhi Nagar Chauraha', 26.474, 80.326, true),
  ('7cb2e736-3262-4d68-80c9-4740ee0bb8c9', 'General Ganj', 'Kanpur', 'Ward 104', 'Kanpur Nagar', 'General Ganj Chauraha', 26.464, 80.345, true),
  ('f1ba23c8-f52b-470c-927f-765bc8522014', 'Govind Nagar', 'Kanpur', 'Ward 54', 'Kanpur Nagar', 'C-Block Market', 26.4432, 80.3015, true),
  ('4de8d394-d781-4e40-8980-925be47ea870', 'Gumti No. 5', 'Kanpur', 'Ward 28', 'Kanpur Nagar', 'Gumti Central Market', 26.4712, 80.3156, true),
  ('43ed9bc0-63c4-4a5d-afb8-72451deb0b6b', 'Gwaltoli', 'Kanpur', 'Ward 4', 'Kanpur Nagar', 'Gwaltoli Chauraha', 26.48, 80.342, true),
  ('eaf37c91-25c2-4fa0-a83a-8dd0d41d3242', 'Hans Puram', 'Kanpur', 'Ward 41', 'Kanpur Nagar', 'Hans Puram Chauraha', 26.4005, 80.365, true),
  ('a244ec07-e39a-44ae-8263-bb2cd230db8a', 'Hans Puram Awas Vikas', 'Kanpur', 'Ward 22', 'Kanpur Nagar', 'Awas Vikas Hans Puram', 26.405, 80.36, true),
  ('3508a7f5-9dfd-495b-89c5-5d66211d4049', 'Jajmau North', 'Kanpur', 'Ward 96', 'Kanpur Nagar', 'Jajmau Bridge', 26.438, 80.408, true),
  ('41ead400-0b75-45d9-b0fa-c8d50e809768', 'Jajmau South', 'Kanpur', 'Ward 73', 'Kanpur Nagar', 'Jajmau Chauraha', 26.43, 80.405, true),
  ('f7b72fcc-2cea-4592-a453-944739fef10c', 'Jarauli', 'Kanpur', 'Ward 82', 'Kanpur Nagar', 'Jarauli Chauraha', 26.405, 80.345, true),
  ('a40ac6f2-50be-4e9a-b1f0-dce7e8c9e1af', 'Jawahar Nagar', 'Kanpur', 'Ward 5', 'Kanpur Nagar', 'Jawahar Nagar Chauraha', 26.478, 80.33, true),
  ('02c79b7b-6640-4c6d-9535-02b6b9f12420', 'Juhi Kala', 'Kanpur', 'Ward 84', 'Kanpur Nagar', 'Juhi Kala Chauraha', 26.424, 80.335, true),
  ('a3a08823-6bb2-4c8f-9966-b7cd6bcd5542', 'Kakadeo', 'Kanpur', 'Ward 42', 'Kanpur Nagar', 'Deoki Cinema Crossing', 26.4789, 80.2974, true),
  ('9a5751c2-ac09-41d8-add9-e66e2f96d54e', 'Kalyanpur', 'Kanpur', 'Ward 38', 'Kanpur Nagar', 'Near Kalyanpur Railway Crossing', 26.4927, 80.2589, true),
  ('14d0c5b7-920d-437e-ac72-2fb238db70e9', 'Khandipur', 'Kanpur', 'Ward 21', 'Kanpur Nagar', 'Khandipur Chauraha', 26.43, 80.365, true),
  ('91f79963-95f4-47fa-904c-1a4c8d4053db', 'Khyora', 'Kanpur', 'Ward 44', 'Kanpur Nagar', 'Khyora Chauraha', 26.52, 80.285, true),
  ('1cdec55d-a068-4d88-b8cf-3586ac4c998e', 'Kidwai Nagar', 'Kanpur', 'Ward 62', 'Kanpur Nagar', 'Kidwai Nagar Central Park', 26.4358, 80.3341, true),
  ('39ec1552-2ac5-4128-8f73-eca36d512cc5', 'Kidwai Nagar North', 'Kanpur', 'Ward 100', 'Kanpur Nagar', 'Kidwai Nagar', 26.438, 80.342, true),
  ('bceac16e-51a3-40a2-be2c-76635d974b4e', 'Kidwai Nagar South', 'Kanpur', 'Ward 92', 'Kanpur Nagar', 'Kidwai Nagar', 26.43, 80.34, true),
  ('eb7a1547-9875-47bb-a1c2-dfddd147d166', 'Laxmi Purwa', 'Kanpur', 'Ward 1', 'Kanpur Nagar', 'Laxmi Purwa Chauraha', 26.4542, 80.3378, true),
  ('a1eadd24-319d-46b8-a0d4-c1d102f0ab8e', 'Maheshwari Mohal', 'Kanpur', 'Ward 98', 'Kanpur Nagar', 'Maheshwari Mohal', 26.466, 80.352, true),
  ('daa1a5cb-b53b-4601-b3a7-6077114cc130', 'Naubasta East', 'Kanpur', 'Ward 63', 'Kanpur Nagar', 'Naubasta Chauraha', 26.407, 80.37, true),
  ('60761299-2069-4980-82be-65b797ad42de', 'Nawabganj', 'Kanpur', 'Ward 43', 'Kanpur Nagar', 'Nawabganj Chauraha', 26.505, 80.33, true),
  ('7804b026-2523-4c4e-a6d0-292a1bcecc5c', 'Nazir Bagh', 'Kanpur', 'Ward 109', 'Kanpur Nagar', 'Nazir Bagh', 26.473, 80.341, true),
  ('149b8003-72ae-4f81-8e22-4fa4748b61a3', 'Panki', 'Kanpur', 'Ward 57', 'Kanpur Nagar', 'Panki hanuman Mandir', 26.4499, 80.3319, true),
  ('7b461b6b-2193-48b9-9417-5227fa3c6260', 'Parade', 'Kanpur', 'Ward 10', 'Kanpur Nagar', 'Naveen Market Area', 26.4635, 80.3498, true),
  ('b0d41ad6-3fa1-44fe-9699-60dc89151688', 'Pashupati Nagar', 'Kanpur', 'Ward 66', 'Kanpur Nagar', 'Pashupati Nagar', 26.412, 80.355, true),
  ('ee0500f6-a96a-45aa-ac98-738aa2b832de', 'Patkapur', 'Kanpur', 'Ward 94', 'Kanpur Nagar', 'Patkapur Chauraha', 26.469, 80.354, true),
  ('ee092b20-dbd3-4510-b70e-080328e86aa1', 'Rai Purwa', 'Kanpur', 'Ward 32', 'Kanpur Nagar', 'Rai Purwa Chauraha', 26.4617, 80.337, true),
  ('6777f4ae-9815-4ba9-9ec4-d1bf7b16f9a8', 'Rajeev Nagar Naubasta East', 'Kanpur', 'Ward 68', 'Kanpur Nagar', 'Rajeev Nagar', 26.401, 80.375, true),
  ('552d3575-6758-43e5-ba07-6a932eeb2e3c', 'Safipur', 'Kanpur', 'Ward 11', 'Kanpur Nagar', 'Safipur Chauraha', 26.434, 80.397, true),
  ('e4e404c0-1dd3-4438-87db-d0b70d65f889', 'Shastri Nagar', 'Kanpur', 'Ward 33', 'Kanpur Nagar', 'Near Central Park', 26.4678, 80.3065, true),
  ('4d208a09-f2cf-465f-af3e-213d44a56901', 'Shyam Nagar Sujat Ganj', 'Kanpur', 'Ward 74', 'Kanpur Nagar', 'Shyam Nagar Chauraha', 26.415, 80.39, true),
  ('1e2d901c-b7e8-4577-90bc-44efa35b2bc2', 'Sishamau North', 'Kanpur', 'Ward 59', 'Kanpur Nagar', 'Sishamau Chauraha', 26.48, 80.325, true),
  ('e81efa57-01e3-4d15-98d3-028b6f576c6b', 'Swarda Jayanti Vihar', 'Kanpur', 'Ward 62', 'Kanpur Nagar', 'Swarda Jayanti Vihar', 26.41, 80.385, true),
  ('90558827-d24b-47d1-9007-c9fce7decd03', 'Swaroop Nagar', 'Kanpur', 'Ward 21', 'Kanpur Nagar', 'Near Motijheel Gate', 26.4815, 80.3182, true),
  ('069e454e-4681-42e5-acae-fc7081955651', 'Talak Mohal', 'Kanpur', 'Ward 108', 'Kanpur Nagar', 'Talak Mohal Chauraha', 26.455, 80.355, true),
  ('fb4e126f-a49d-4e4f-aba8-5006b64380d7', 'Tilak Nagar', 'Kanpur', 'Ward 61', 'Kanpur Nagar', 'Tilak Nagar Chauraha', 26.485, 80.315, true),
  ('e6d22b18-9a30-4cfa-bf96-03306096ea82', 'Tiwari Pur', 'Kanpur', 'Ward 58', 'Kanpur Nagar', 'Tiwari Pur Chauraha', 26.435, 80.375, true),
  ('572005db-6614-40d1-b7b4-6ec914c0f6ee', 'Usmanpur', 'Kanpur', 'Ward 18', 'Kanpur Nagar', 'Usmanpur Chauraha', 26.423, 80.35, true),
  ('17c03353-0763-455c-a3fc-cf3ba793fdd0', 'Yashoda Nagar East', 'Kanpur', 'Ward 46', 'Kanpur Nagar', 'Yashoda Nagar Chauraha', 26.421, 80.355, true),
  ('ab46b6fa-66b6-4d7c-bc0c-84562aae4781', 'Yashoda Nagar West', 'Kanpur', 'Ward 95', 'Kanpur Nagar', 'Yashoda Nagar', 26.419, 80.347, true)
) AS v(id, name, city, ward, district, landmark, latitude, longitude, active)
WHERE LOWER(a.name) = LOWER(v.name);

-- 3. Officers: insert missing seed records
INSERT INTO public.officers (id, name, employee_id, email, mobile, username, password_hash, department, area_name, area_id, designation, status)
SELECT v.id::uuid, v.name, v.employee_id, v.email, v.mobile, v.username, v.password_hash, v.department, v.area_name, v.area_id::uuid, v.designation, v.status
FROM (VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Er. Vikram Singh', 'OFF-KN-2024-01', 'vikram.singh@kanpur.gov.in', '9876543210', 'officer1', 'password123', 'Public Works Department (PWD)', 'Kalyanpur', 'b0000000-0000-0000-0000-000000000001', 'Junior Engineer', 'Active'),
  ('c0000000-0000-0000-0000-000000000002', 'Smt. Sunita Yadav', 'OFF-KN-2024-02', 'sunita.yadav@kanpur.gov.in', '9876543211', 'officer2', 'password123', 'Jal Sansthan (Water & Drainage)', 'Kakadeo', 'b0000000-0000-0000-0000-000000000002', 'Assistant Engineer', 'Active')
) AS v(id, name, employee_id, email, mobile, username, password_hash, department, area_name, area_id, designation, status)
WHERE NOT EXISTS (
  SELECT 1 FROM public.officers o WHERE o.id = v.id::uuid OR o.username = v.username
);

-- ==============================================================================
-- SUPABASE REALTIME PUBLICATION CONFIGURATION
-- ==============================================================================
-- Full row replica identity for detailed real-time events
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
ALTER TABLE public.complaint_media REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.officer_activity_logs REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_media;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.officer_activity_logs;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ==============================================================================
-- POSTGREST ROLES & SCHEMA PERMISSIONS (Fixes 'permission denied for table ...')
-- ==============================================================================
-- Ensure the PostgREST API roles have schema usage and table privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Automatically grant privileges on all future tables created in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Force PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';


