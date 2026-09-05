-- Supabase Migration: 20260905000000_meetflow_schema.sql
-- Production schema for MeetFlow with RLS, Tables, Indexes, and Storage

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('Manager', 'Employee')),
  recipient_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('meeting', 'task_deadline', 'task_overdue', 'task_completed')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'urgent')),
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  related_meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio', 'meeting-audio', false)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_meetings_company_id ON public.meetings(company_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_company_id ON public.transcripts(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON public.tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_alerts_company_id ON public.alerts(company_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER tr_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER tr_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER tr_transcripts_updated_at BEFORE UPDATE ON public.transcripts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER tr_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company" ON public.companies FOR SELECT TO authenticated USING (id = public.get_auth_user_company_id());
CREATE POLICY "Users can view profiles within their company" ON public.profiles FOR SELECT TO authenticated USING (company_id = public.get_auth_user_company_id());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Company members can view employees" ON public.employees FOR SELECT TO authenticated USING (company_id = public.get_auth_user_company_id());
CREATE POLICY "Managers can insert employees in their company" ON public.employees FOR INSERT TO authenticated WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can update employees in their company" ON public.employees FOR UPDATE TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can delete employees in their company" ON public.employees FOR DELETE TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Company members can view meetings" ON public.meetings FOR SELECT TO authenticated USING (company_id = public.get_auth_user_company_id());
CREATE POLICY "Managers can insert meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can update meetings" ON public.meetings FOR UPDATE TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can delete meetings" ON public.meetings FOR DELETE TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can view company transcripts" ON public.transcripts FOR SELECT TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can insert transcripts" ON public.transcripts FOR INSERT TO authenticated WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can update transcripts" ON public.transcripts FOR UPDATE TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Managers can delete transcripts" ON public.transcripts FOR DELETE TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Tasks select policy" ON public.tasks FOR SELECT TO authenticated USING (company_id = public.get_auth_user_company_id() AND (public.get_auth_user_role() = 'Manager' OR employee_id = public.get_auth_user_employee_id()));
CREATE POLICY "Managers can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Tasks update policy" ON public.tasks FOR UPDATE TO authenticated USING (company_id = public.get_auth_user_company_id() AND (public.get_auth_user_role() = 'Manager' OR employee_id = public.get_auth_user_employee_id()));
CREATE POLICY "Managers can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (company_id = public.get_auth_user_company_id() AND public.get_auth_user_role() = 'Manager');
CREATE POLICY "Alerts select policy" ON public.alerts FOR SELECT TO authenticated USING (company_id = public.get_auth_user_company_id() AND ((public.get_auth_user_role() = 'Manager' AND recipient_role = 'Manager') OR (public.get_auth_user_role() = 'Employee' AND recipient_role = 'Employee' AND recipient_id = public.get_auth_user_employee_id())));
CREATE POLICY "Alerts update policy" ON public.alerts FOR UPDATE TO authenticated USING (company_id = public.get_auth_user_company_id() AND ((public.get_auth_user_role() = 'Manager' AND recipient_role = 'Manager') OR (public.get_auth_user_role() = 'Employee' AND recipient_role = 'Employee' AND recipient_id = public.get_auth_user_employee_id())));
