-- ==============================================================================
-- Civic Portal - Fix Complaints & Related Tables Schema
-- ==============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Select your project: zskzvwfokynbngyumaec
-- 3. Navigate to "SQL Editor" on the left navigation bar
-- 4. Click "New Query", paste this entire script, and click "Run" (or Ctrl+Enter)
-- ==============================================================================

-- 1. COMPLAINTS TABLE: Add all missing columns safely
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
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS complaint_code TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Submitted';
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS duplicate_of TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS officer_name TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS officer_id UUID REFERENCES public.officers(id) ON DELETE SET NULL;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS created_by_id UUID;
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
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Update status check constraint on complaints to allow all valid statuses
DO $$
BEGIN
  ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
  ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check 
    CHECK (status IN ('Submitted', 'Pending', 'In Review', 'Assigned', 'Accepted', 'Work Started', 'In Progress', 'Work Completed', 'Resolved', 'Rejected'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Update media phase check constraint to include citizen uploads
DO $$
BEGIN
  ALTER TABLE public.complaint_media DROP CONSTRAINT IF EXISTS complaint_media_phase_check;
  ALTER TABLE public.complaint_media ADD CONSTRAINT complaint_media_phase_check 
    CHECK (phase IN ('citizen', 'before', 'during', 'after'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. DEPARTMENTS TABLE: Sync timestamp columns
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3. AREAS TABLE: Sync timestamp columns
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 4. OFFICERS TABLE: Sync timestamp, photo, area, and updated_at columns
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS area_name TEXT;
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 5. PROFILES TABLE: Ensure avatar_url and phone exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 6. COMPLAINT_MEDIA TABLE: Sync timestamp columns
ALTER TABLE public.complaint_media ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.complaint_media ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.complaint_media ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 7. NOTIFICATIONS TABLE: Ensure read / is_read and timestamp columns exist
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 8. Backfill and synchronize existing rows for timestamps and read status
UPDATE public.departments SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now());
UPDATE public.areas SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now());
UPDATE public.officers SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now());
UPDATE public.complaint_media SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now());
UPDATE public.notifications SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now()), read = COALESCE(read, is_read, false), is_read = COALESCE(is_read, read, false);
UPDATE public.complaints SET created_date = COALESCE(created_date, created_at, now()), created_at = COALESCE(created_at, created_date, now());

-- 9. Row Level Security policies for complaints (ensure public access where required)
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

-- 10. Supabase Realtime publication setup
ALTER TABLE public.complaints REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 11. Schema Permissions for PostgREST API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 12. CRITICAL: Force PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';
