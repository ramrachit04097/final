-- Migration: Add password_reset_otps table
-- Strictly stores hashed OTPs with automatic timestamps, attempt counters, and Row Level Security.
-- Never store plaintext OTPs.

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
