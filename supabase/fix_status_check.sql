-- ==============================================================================
-- Civic Portal - Fix Complaints Status Check Constraint
-- ==============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Select your project
-- 3. Go to SQL Editor -> New Query
-- 4. Paste this script and click Run (Ctrl+Enter)
-- ==============================================================================

-- 1. Drop the restrictive status constraint and recreate with ALL portal statuses
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;

ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check 
  CHECK (status IN (
    'Submitted',
    'Pending',
    'In Review',
    'Assigned',
    'Accepted',
    'Work Started',
    'In Progress',
    'Work Completed',
    'Resolved',
    'Rejected'
  ));

-- 2. Ensure complaint media phase constraint allows citizen evidence
ALTER TABLE public.complaint_media DROP CONSTRAINT IF EXISTS complaint_media_phase_check;

ALTER TABLE public.complaint_media ADD CONSTRAINT complaint_media_phase_check 
  CHECK (phase IN ('citizen', 'before', 'during', 'after'));

-- 3. Ensure priority constraint includes all valid levels
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_priority_check;

ALTER TABLE public.complaints ADD CONSTRAINT complaints_priority_check 
  CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent'));

-- 4. Force PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';
