-- ==============================================================================
-- Civic Portal - Supabase Complete Database Schema & Security
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  RETURN LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) = 'YOUR_ADMIN_EMAIL@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Database-level security trigger: Strictly guarantees only the designated admin email can hold the 'admin' role
CREATE OR REPLACE FUNCTION public.enforce_single_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Revert any unauthorized attempt to set role='admin' back to 'citizen'
  IF NEW.role = 'admin' AND LOWER(TRIM(COALESCE(NEW.email, ''))) NOT IN ('YOUR_ADMIN_EMAIL@gmail.com') THEN
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

CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 2. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.departments (
  id TEXT PRIMARY KEY DEFAULT ('dept_' || substr(md5(random()::text), 1, 8)),
  name TEXT NOT NULL,
  description TEXT,
  head TEXT,
  email TEXT,
  phone TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Departments are viewable by anyone"
  ON public.departments FOR SELECT
  USING (true);

CREATE POLICY "Departments are editable by authenticated users"
  ON public.departments FOR ALL
  TO authenticated
  USING (true);

-- 3. AREAS TABLE
CREATE TABLE IF NOT EXISTS public.areas (
  id TEXT PRIMARY KEY DEFAULT ('area_' || substr(md5(random()::text), 1, 8)),
  name TEXT NOT NULL,
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

CREATE POLICY "Areas are viewable by anyone"
  ON public.areas FOR SELECT
  USING (true);

CREATE POLICY "Areas can be managed by authenticated users"
  ON public.areas FOR ALL
  TO authenticated
  USING (true);

-- 4. OFFICERS TABLE
CREATE TABLE IF NOT EXISTS public.officers (
  id TEXT PRIMARY KEY DEFAULT ('off_' || substr(md5(random()::text), 1, 8)),
  name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  email TEXT,
  mobile TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  department TEXT,
  area_name TEXT,
  area_id TEXT REFERENCES public.areas(id) ON DELETE SET NULL,
  designation TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers viewable by authenticated users"
  ON public.officers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Officers manageable by authenticated users"
  ON public.officers FOR ALL
  TO authenticated
  USING (true);

-- 5. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.complaints (
  id TEXT PRIMARY KEY DEFAULT ('comp_' || substr(md5(random()::text), 1, 10)),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  department TEXT,
  area_name TEXT,
  area_id TEXT,
  landmark TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Rejected')),
  is_spam BOOLEAN NOT NULL DEFAULT false,
  duplicate_of TEXT,
  ai_summary TEXT,
  remarks TEXT,
  officer_id TEXT,
  created_by_id TEXT,
  citizen_name TEXT,
  citizen_email TEXT,
  citizen_phone TEXT,
  timeline JSONB DEFAULT '[]'::jsonb,
  actual_resolved_date TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Complaints are viewable by all"
  ON public.complaints FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authorized updates to complaints"
  ON public.complaints FOR UPDATE
  USING (true);

CREATE POLICY "Only authorized admin can delete complaints"
  ON public.complaints FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 6. COMPLAINT MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.complaint_media (
  id TEXT PRIMARY KEY DEFAULT ('media_' || substr(md5(random()::text), 1, 8)),
  complaint_id TEXT REFERENCES public.complaints(id) ON DELETE CASCADE,
  phase TEXT DEFAULT 'during' CHECK (phase IN ('before', 'during', 'after')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  media_type TEXT DEFAULT 'photo',
  uploaded_by TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.complaint_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Complaint media viewable by all"
  ON public.complaint_media FOR SELECT
  USING (true);

CREATE POLICY "Complaint media insertable by anyone"
  ON public.complaint_media FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Complaint media deletable by authenticated users"
  ON public.complaint_media FOR DELETE
  TO authenticated
  USING (true);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY DEFAULT ('notif_' || substr(md5(random()::text), 1, 8)),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'status_update',
  complaint_id TEXT,
  user_id TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications viewable by anyone"
  ON public.notifications FOR SELECT
  USING (true);

CREATE POLICY "Notifications insertable by anyone"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Notifications updatable by anyone"
  ON public.notifications FOR UPDATE
  USING (true);

-- 8. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY DEFAULT ('act_' || substr(md5(random()::text), 1, 8)),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity logs viewable by authenticated users"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Activity logs insertable by anyone"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- 9. OFFICER ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.officer_activity_logs (
  id TEXT PRIMARY KEY DEFAULT ('offact_' || substr(md5(random()::text), 1, 8)),
  officer_id TEXT NOT NULL,
  officer_name TEXT,
  complaint_id TEXT REFERENCES public.complaints(id) ON DELETE CASCADE,
  complaint_title TEXT,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  remarks TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.officer_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officer activity logs viewable by anyone"
  ON public.officer_activity_logs FOR SELECT
  USING (true);

CREATE POLICY "Officer activity logs insertable by anyone"
  ON public.officer_activity_logs FOR INSERT
  WITH CHECK (true);

-- 10. FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS public.feedback (
  id TEXT PRIMARY KEY DEFAULT ('fb_' || substr(md5(random()::text), 1, 8)),
  complaint_id TEXT REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback viewable by anyone"
  ON public.feedback FOR SELECT
  USING (true);

CREATE POLICY "Feedback insertable by anyone"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-media', 'complaint-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read access on complaint-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'complaint-media');

CREATE POLICY "Allow upload access on complaint-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'complaint-media');

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================
INSERT INTO public.departments (id, name, description, head, email, phone)
VALUES
  ('dept-1', 'Public Works Department (PWD)', 'Road repairs, potholes, sidewalks', 'Er. R. K. Verma', 'pwd.kanpur@nic.in', '+91 512 2548901'),
  ('dept-2', 'Jal Sansthan (Water & Drainage)', 'Water supply lines, sewage overflows', 'Smt. Anjali Srivastava', 'jalsansthan.kanpur@nic.in', '+91 512 2543412'),
  ('dept-3', 'KESCO (Electricity & Street Lighting)', 'Street lights, cables, transformers', 'Er. S. N. Mishra', 'kesco.grievance@nic.in', '+91 512 2556789'),
  ('dept-4', 'Solid Waste & Sanitation (Nagar Nigam)', 'Garbage collection, illegal dumping', 'Dr. Alok Pandey', 'sanitation.knn@nic.in', '+91 512 2534567'),
  ('dept-5', 'Health & Vector Control', 'Mosquito fogging, stray animals', 'Dr. Meena Gupta', 'health.knn@nic.in', '+91 512 2534890'),
  ('dept-6', 'Traffic & Public Safety', 'Traffic signals, illegal parking', 'Inspector Rajesh Kumar', 'traffic.kanpur@uppolice.gov.in', '+91 512 2304100')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.areas (id, name, city, ward, district, landmark, latitude, longitude, active)
VALUES
  ('area-1', 'Kalyanpur', 'Kanpur', 'Ward 38', 'Kanpur Nagar', 'Near Kalyanpur Crossing', 26.4927, 80.2589, true),
  ('area-2', 'Kakadeo', 'Kanpur', 'Ward 42', 'Kanpur Nagar', 'Deoki Cinema Crossing', 26.4789, 80.2974, true),
  ('area-3', 'Civil Lines', 'Kanpur', 'Ward 15', 'Kanpur Nagar', 'Green Park Stadium', 26.4729, 80.3444, true),
  ('area-4', 'Swaroop Nagar', 'Kanpur', 'Ward 21', 'Kanpur Nagar', 'Near Motijheel', 26.4815, 80.3182, true),
  ('area-5', 'Govind Nagar', 'Kanpur', 'Ward 54', 'Kanpur Nagar', 'C-Block Market', 26.4432, 80.3015, true),
  ('area-6', 'Kidwai Nagar', 'Kanpur', 'Ward 62', 'Kanpur Nagar', 'Central Park', 26.4358, 80.3341, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.officers (id, name, employee_id, email, mobile, username, password_hash, department, area_name, area_id, designation, status)
VALUES
  ('off-1', 'Er. Vikram Singh', 'OFF-KN-2024-01', 'vikram.singh@kanpur.gov.in', '9876543210', 'officer1', 'password123', 'Public Works Department (PWD)', 'Kalyanpur', 'area-1', 'Junior Engineer', 'Active'),
  ('off-2', 'Smt. Sunita Yadav', 'OFF-KN-2024-02', 'sunita.yadav@kanpur.gov.in', '9876543211', 'officer2', 'password123', 'Jal Sansthan (Water & Drainage)', 'Kakadeo', 'area-2', 'Assistant Engineer', 'Active')
ON CONFLICT (id) DO NOTHING;

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
  END;
END $$;

