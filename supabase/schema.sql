-- ==============================================================================
-- SMART COMPLAINT MANAGEMENT SYSTEM - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- Run this entire script in your Supabase project's SQL Editor:
-- https://app.supabase.com -> Project -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create a profile when a new user registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'citizen')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. DEPARTMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  head TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. AREAS / LOCALITIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT DEFAULT 'Kanpur',
  ward TEXT,
  district TEXT DEFAULT 'Kanpur Nagar',
  landmark TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. OFFICERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.officers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  employee_id TEXT,
  email TEXT,
  mobile TEXT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  department TEXT,
  area_id TEXT,
  area_name TEXT,
  designation TEXT,
  profile_photo TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. COMPLAINTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_code TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT DEFAULT 'Pending' CHECK (status IN (
    'Pending', 'In Review', 'Assigned', 'Accepted', 'Work Started',
    'In Progress', 'Work Completed', 'Resolved', 'Rejected'
  )),
  location TEXT,
  area TEXT,
  area_id TEXT,
  location_name TEXT,
  formatted_address TEXT,
  google_place_id TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  photo_url TEXT,
  department TEXT,
  officer_id TEXT,
  officer_name TEXT,
  remarks TEXT,
  ai_summary TEXT,
  is_spam BOOLEAN DEFAULT FALSE,
  duplicate_of TEXT,
  estimated_days INTEGER,
  expected_date TIMESTAMPTZ,
  actual_resolved_date TIMESTAMPTZ,
  is_delayed BOOLEAN DEFAULT FALSE,
  temporary_solution TEXT,
  temp_alt_facility TEXT,
  temp_alt_route TEXT,
  temp_availability_time TEXT,
  temp_contact TEXT,
  timeline JSONB DEFAULT '[]'::jsonb,
  created_by_id TEXT,
  created_by_email TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. COMPLAINT MEDIA TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  media_type TEXT DEFAULT 'photo' CHECK (media_type IN ('photo', 'video')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  phase TEXT DEFAULT 'citizen' CHECK (phase IN ('citizen', 'before', 'during', 'after')),
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. FEEDBACK TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_by_id TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'system' CHECK (type IN ('status_update', 'remark', 'system', 'assignment')),
  is_read BOOLEAN DEFAULT FALSE,
  complaint_id TEXT,
  officer_id TEXT,
  user_id TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. ACTIVITY LOGS (Admin Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. OFFICER ACTIVITY LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.officer_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  officer_id TEXT NOT NULL,
  officer_name TEXT,
  complaint_id TEXT,
  complaint_title TEXT,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  remarks TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. STORAGE BUCKET FOR EVIDENCE MEDIA
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-media', 'complaint-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read access to evidence media
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'complaint-media');

-- Policy to allow authenticated and anon uploads to complaint-media bucket
CREATE POLICY "Public or Authenticated Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'complaint-media');

-- ------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officer_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users for departments, areas, officers
CREATE POLICY "Public Read Departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admin Write Departments" ON public.departments FOR ALL USING (true);

CREATE POLICY "Public Read Areas" ON public.areas FOR SELECT USING (true);
CREATE POLICY "Admin Write Areas" ON public.areas FOR ALL USING (true);

CREATE POLICY "Public Read Officers" ON public.officers FOR SELECT USING (true);
CREATE POLICY "Admin Write Officers" ON public.officers FOR ALL USING (true);

-- Profiles policies
CREATE POLICY "Read Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Update Own Profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Complaints policies
CREATE POLICY "Read Complaints" ON public.complaints FOR SELECT USING (true);
CREATE POLICY "Insert Complaints" ON public.complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Update Complaints" ON public.complaints FOR UPDATE USING (true);
CREATE POLICY "Delete Complaints" ON public.complaints FOR DELETE USING (true);

-- Complaint Media policies
CREATE POLICY "Read Complaint Media" ON public.complaint_media FOR SELECT USING (true);
CREATE POLICY "Insert Complaint Media" ON public.complaint_media FOR INSERT WITH CHECK (true);
CREATE POLICY "Delete Complaint Media" ON public.complaint_media FOR DELETE USING (true);

-- Feedback policies
CREATE POLICY "Read Feedback" ON public.feedback FOR SELECT USING (true);
CREATE POLICY "Insert Feedback" ON public.feedback FOR INSERT WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Read Notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Write Notifications" ON public.notifications FOR ALL USING (true);

-- Logs policies
CREATE POLICY "Read Activity Logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Insert Activity Logs" ON public.activity_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Read Officer Logs" ON public.officer_activity_logs FOR SELECT USING (true);
CREATE POLICY "Insert Officer Logs" ON public.officer_activity_logs FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 13. SEED DATA
-- ------------------------------------------------------------------------------

-- Seed Municipal Departments
INSERT INTO public.departments (name, description, head, email, phone)
VALUES
  ('Public Works Department (PWD)', 'Road repairs, potholes, sidewalks, and civil infrastructure', 'Er. R. K. Verma', 'pwd.kanpur@nic.in', '+91 512 2548901'),
  ('Jal Sansthan (Water & Drainage)', 'Water supply lines, contaminated water, drainage & sewage overflows', 'Smt. Anjali Srivastava', 'jalsansthan.kanpur@nic.in', '+91 512 2543412'),
  ('KESCO (Electricity & Street Lighting)', 'Street light breakdown, loose electrical cables, power transformer issues', 'Er. S. N. Mishra', 'kesco.grievance@nic.in', '+91 512 2556789'),
  ('Solid Waste & Sanitation (Nagar Nigam)', 'Garbage collection, illegal dumping, public dustbins, drain desilting', 'Dr. Alok Pandey', 'sanitation.knn@nic.in', '+91 512 2534567'),
  ('Health & Vector Control', 'Mosquito fogging, stray animal management, public health hazards', 'Dr. Meena Gupta', 'health.knn@nic.in', '+91 512 2534890'),
  ('Traffic & Public Safety', 'Illegal parking, broken signals, traffic hazard obstructions', 'Inspector Rajesh Kumar', 'traffic.kanpur@uppolice.gov.in', '+91 512 2304100')
ON CONFLICT (name) DO NOTHING;

-- Seed Kanpur Localities / Areas
INSERT INTO public.areas (name, city, ward, district, landmark, latitude, longitude, active)
VALUES
  ('Kalyanpur', 'Kanpur', 'Ward 38', 'Kanpur Nagar', 'Near Kalyanpur Railway Crossing', 26.4927, 80.2589, true),
  ('Kakadeo', 'Kanpur', 'Ward 42', 'Kanpur Nagar', 'Deoki Cinema Crossing', 26.4789, 80.2974, true),
  ('Civil Lines', 'Kanpur', 'Ward 15', 'Kanpur Nagar', 'Opposite Green Park Stadium', 26.4729, 80.3444, true),
  ('Swaroop Nagar', 'Kanpur', 'Ward 21', 'Kanpur Nagar', 'Near Motijheel Gate', 26.4815, 80.3182, true),
  ('Govind Nagar', 'Kanpur', 'Ward 54', 'Kanpur Nagar', 'C-Block Market', 26.4432, 80.3015, true),
  ('Kidwai Nagar', 'Kanpur', 'Ward 62', 'Kanpur Nagar', 'Kidwai Nagar Central Park', 26.4358, 80.3341, true),
  ('Shastri Nagar', 'Kanpur', 'Ward 33', 'Kanpur Nagar', 'Near Central Park', 26.4678, 80.3065, true),
  ('Barra', 'Kanpur', 'Ward 71', 'Kanpur Nagar', 'Barra 2 Bypass', 26.4215, 80.2954, true),
  ('Gumti No. 5', 'Kanpur', 'Ward 28', 'Kanpur Nagar', 'Gumti Central Market', 26.4712, 80.3156, true),
  ('Parade', 'Kanpur', 'Ward 10', 'Kanpur Nagar', 'Naveen Market Area', 26.4635, 80.3498, true)
ON CONFLICT DO NOTHING;

-- Seed Sample Active Officer
INSERT INTO public.officers (name, employee_id, email, mobile, username, password_hash, department, area_name, designation, status)
VALUES
  ('Er. Vikram Singh', 'OFF-KN-2024-01', 'vikram.singh@kanpur.gov.in', '9876543210', 'officer1', 'password123', 'Public Works Department (PWD)', 'Kalyanpur', 'Junior Engineer', 'Active'),
  ('Smt. Sunita Yadav', 'OFF-KN-2024-02', 'sunita.yadav@kanpur.gov.in', '9876543211', 'officer2', 'password123', 'Jal Sansthan (Water & Drainage)', 'Kakadeo', 'Assistant Engineer', 'Active')
ON CONFLICT (username) DO NOTHING;

-- ==============================================================================
-- SCHEMA CREATION COMPLETE
-- ==============================================================================
