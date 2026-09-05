-- MeetFlow Supabase Production Schema & Migrations
-- Comprehensive PostgreSQL schema with Row Level Security (RLS),
-- Profiles, Companies, Employees, Meetings, Transcripts, Tasks, Alerts,
-- and Storage policies.

-- Enable pgcrypto / uuid extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------
-- 1. Companies Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 2. Profiles Table (Linked to auth.users)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Manager', 'Employee')),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id TEXT,
  manager_id TEXT,
  post TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 3. Employees Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_post TEXT NOT NULL DEFAULT 'Team Member',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ,
  CONSTRAINT unique_company_employee_id UNIQUE (company_id, employee_id)
);

-- -------------------------------------------------------------
-- 4. Meetings Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 5. Transcripts Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  meeting_title TEXT NOT NULL,
  transcript_text TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  speakers JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'reviewed', 'archived')),
  audio_storage_path TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 6. Tasks Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_post TEXT NOT NULL DEFAULT 'Team Member',
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  transcript_id UUID REFERENCES public.transcripts(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 7. Alerts Table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('Manager', 'Employee')),
  recipient_id TEXT, -- employeeId when role is Employee
  type TEXT NOT NULL CHECK (type IN ('meeting', 'task_deadline', 'task_overdue', 'task_completed')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'urgent')),
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  related_meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 8. Storage Bucket for Meeting Audio
-- -------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio', 'meeting-audio', false)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- 9. Performance Indexes
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_meetings_company_id ON public.meetings(company_id);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON public.meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_transcripts_company_id ON public.transcripts(company_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON public.transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON public.tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_alerts_company_id ON public.alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_recipient ON public.alerts(recipient_role, recipient_id);

-- -------------------------------------------------------------
-- 10. Automatic updated_at Trigger
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER tr_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER tr_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER tr_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER tr_transcripts_updated_at
BEFORE UPDATE ON public.transcripts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER tr_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------
-- 11. Helper Functions for RLS
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_employee_id()
RETURNS TEXT AS $$
  SELECT employee_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- -------------------------------------------------------------
-- 12. Row Level Security (RLS) Activation
-- -------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 13. RLS Policies: Companies
-- -------------------------------------------------------------
CREATE POLICY "Users can view their own company"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (id = public.get_auth_user_company_id());

CREATE POLICY "Managers can update their own company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

-- -------------------------------------------------------------
-- 14. RLS Policies: Profiles
-- -------------------------------------------------------------
CREATE POLICY "Users can view profiles within their company"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_auth_user_company_id());

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their initial profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- -------------------------------------------------------------
-- 15. RLS Policies: Employees
-- -------------------------------------------------------------
CREATE POLICY "Company members can view employees"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_auth_user_company_id());

CREATE POLICY "Managers can insert employees in their company"
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can update employees in their company"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can delete employees in their company"
  ON public.employees
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

-- -------------------------------------------------------------
-- 16. RLS Policies: Meetings
-- -------------------------------------------------------------
CREATE POLICY "Company members can view meetings"
  ON public.meetings
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_auth_user_company_id());

CREATE POLICY "Managers can insert meetings"
  ON public.meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can update meetings"
  ON public.meetings
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can delete meetings"
  ON public.meetings
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

-- -------------------------------------------------------------
-- 17. RLS Policies: Transcripts
-- -------------------------------------------------------------
CREATE POLICY "Managers can view company transcripts"
  ON public.transcripts
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can insert transcripts"
  ON public.transcripts
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can update transcripts"
  ON public.transcripts
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can delete transcripts"
  ON public.transcripts
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

-- -------------------------------------------------------------
-- 18. RLS Policies: Tasks
-- -------------------------------------------------------------
CREATE POLICY "Managers view all company tasks, Employees view assigned tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_auth_user_company_id() AND (
      public.get_auth_user_role() = 'Manager' OR
      employee_id = public.get_auth_user_employee_id()
    )
  );

CREATE POLICY "Managers can insert tasks"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

CREATE POLICY "Managers can update any company task, Employees can update their status"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_auth_user_company_id() AND (
      public.get_auth_user_role() = 'Manager' OR
      employee_id = public.get_auth_user_employee_id()
    )
  );

CREATE POLICY "Managers can delete company tasks"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');

-- -------------------------------------------------------------
-- 19. RLS Policies: Alerts
-- -------------------------------------------------------------
CREATE POLICY "Users view alerts addressed to them or their role"
  ON public.alerts
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_auth_user_company_id() AND (
      (public.get_auth_user_role() = 'Manager' AND recipient_role = 'Manager') OR
      (public.get_auth_user_role() = 'Employee' AND recipient_role = 'Employee' AND recipient_id = public.get_auth_user_employee_id())
    )
  );

CREATE POLICY "Users can mark their own alerts as read"
  ON public.alerts
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_auth_user_company_id() AND (
      (public.get_auth_user_role() = 'Manager' AND recipient_role = 'Manager') OR
      (public.get_auth_user_role() = 'Employee' AND recipient_role = 'Employee' AND recipient_id = public.get_auth_user_employee_id())
    )
  );

-- -------------------------------------------------------------
-- 20. Storage Policies (meeting-audio bucket)
-- -------------------------------------------------------------
CREATE POLICY "Authenticated users can upload meeting audio"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meeting-audio');

CREATE POLICY "Authenticated users can read meeting audio"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'meeting-audio');

-- -------------------------------------------------------------
-- 21. Password Reset OTPs Table (Hash Only, Never Plaintext)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_id ON public.password_reset_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_created_at ON public.password_reset_otps(created_at);

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Deny all direct client-side access (anon and authenticated).
-- Only backend operations using the service_role key can manage OTP hashes.
DROP POLICY IF EXISTS "Deny all client access to password reset otps" ON public.password_reset_otps;
CREATE POLICY "Deny all client access to password reset otps"
  ON public.password_reset_otps
  FOR ALL
  TO public
  USING (false);

