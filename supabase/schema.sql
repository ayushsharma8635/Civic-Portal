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
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Pending', 'In Review', 'In Progress', 'Assigned', 'Resolved', 'Rejected')),
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
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
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

  -- Safe column synchronization: ensure created_date column exists on existing tables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'created_date'
  ) THEN
    BEGIN
      ALTER TABLE public.departments ADD COLUMN created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'areas' AND column_name = 'created_date'
  ) THEN
    BEGIN
      ALTER TABLE public.areas ADD COLUMN created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'officers' AND column_name = 'created_date'
  ) THEN
    BEGIN
      ALTER TABLE public.officers ADD COLUMN created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
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

-- 2. Areas: insert missing seed records
INSERT INTO public.areas (id, name, city, ward, district, landmark, latitude, longitude, active)
SELECT v.id::uuid, v.name, v.city, v.ward, v.district, v.landmark, v.latitude, v.longitude, v.active
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Kalyanpur', 'Kanpur', 'Ward 38', 'Kanpur Nagar', 'Near Kalyanpur Crossing', 26.4927, 80.2589, true),
  ('b0000000-0000-0000-0000-000000000002', 'Kakadeo', 'Kanpur', 'Ward 42', 'Kanpur Nagar', 'Deoki Cinema Crossing', 26.4789, 80.2974, true),
  ('b0000000-0000-0000-0000-000000000003', 'Civil Lines', 'Kanpur', 'Ward 15', 'Kanpur Nagar', 'Green Park Stadium', 26.4729, 80.3444, true),
  ('b0000000-0000-0000-0000-000000000004', 'Swaroop Nagar', 'Kanpur', 'Ward 21', 'Kanpur Nagar', 'Near Motijheel', 26.4815, 80.3182, true),
  ('b0000000-0000-0000-0000-000000000005', 'Govind Nagar', 'Kanpur', 'Ward 54', 'Kanpur Nagar', 'C-Block Market', 26.4432, 80.3015, true),
  ('b0000000-0000-0000-0000-000000000006', 'Kidwai Nagar', 'Kanpur', 'Ward 62', 'Kanpur Nagar', 'Central Park', 26.4358, 80.3341, true)
) AS v(id, name, city, ward, district, landmark, latitude, longitude, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.areas a WHERE a.id = v.id::uuid OR LOWER(a.name) = LOWER(v.name)
);

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

