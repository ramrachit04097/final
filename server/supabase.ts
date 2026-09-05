import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
// Clean the URL so that it points to https://<ref>.supabase.co without trailing /rest/v1 or slashes
const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

let supabaseClient: SupabaseClient | null = null;

export function isServerSupabaseConfigured(): boolean {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    !supabaseUrl.includes('placeholder') &&
    typeof supabaseKey === 'string' &&
    supabaseKey.trim().length > 0 &&
    !supabaseKey.includes('placeholder')
  );
}

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!supabaseClient && isServerSupabaseConfigured()) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.warn('Failed to initialize server-side Supabase client:', err);
    }
  }
  return supabaseClient;
}

export interface SupabaseAuthUserResult {
  id: string;
  email: string;
}

/**
 * Creates or updates an authenticated user in Supabase Auth securely.
 */
export async function createSupabaseAuthAccount(params: {
  email: string;
  password?: string;
  metadata: Record<string, any>;
}): Promise<SupabaseAuthUserResult | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  try {
    // Check if user already exists in Supabase Auth
    const { data: userList } = await client.auth.admin.listUsers();
    const existing = userList?.users?.find(
      (u) => u.email?.toLowerCase() === params.email.toLowerCase()
    );

    if (existing) {
      // Update existing user metadata and password if provided
      const updatePayload: any = {
        user_metadata: { ...existing.user_metadata, ...params.metadata },
        email_confirm: true,
      };
      if (params.password) {
        updatePayload.password = params.password;
      }
      const { data: updated, error: updateErr } = await client.auth.admin.updateUserById(
        existing.id,
        updatePayload
      );
      if (updateErr) {
        console.warn('Supabase auth updateUser error:', updateErr.message);
      }
      return {
        id: updated?.user?.id || existing.id,
        email: updated?.user?.email || existing.email || params.email,
      };
    }

    // Create new Supabase Auth user
    const { data, error } = await client.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: params.metadata,
    });

    if (error) {
      console.warn('Supabase admin.createUser error:', error.message);
      return null;
    }

    if (data?.user) {
      return { id: data.user.id, email: data.user.email || params.email };
    }
  } catch (err) {
    console.warn('Supabase auth account creation failed:', err);
  }
  return null;
}

/**
 * Generates an OTP recovery link via Supabase Auth.
 */
export async function generateSupabaseRecoveryToken(
  email: string
): Promise<{ otp?: string; actionLink?: string } | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  try {
    // Generate recovery link using admin API
    const res = await client.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (res.data?.properties) {
      const otp = res.data.properties.email_otp;
      const actionLink = res.data.properties.action_link;
      return { otp, actionLink };
    }

    // Also trigger standard Supabase reset password email flow if configured
    await client.auth.resetPasswordForEmail(email).catch(() => {});
  } catch (err) {
    console.warn('Supabase generate recovery link failed:', err);
  }
  return null;
}

/**
 * Updates a user's password securely in Supabase Auth.
 */
export async function updateSupabaseUserPassword(
  authUserId: string,
  newPassword: string
): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  try {
    const { error } = await client.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    });
    if (error) {
      console.warn('Supabase updateUserById password error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to update Supabase password:', err);
    return false;
  }
}

/**
 * Updates a user's password in Supabase Auth by email, or provisions account if missing.
 */
export async function updateSupabaseAuthPasswordByEmail(
  email: string,
  newPassword: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  try {
    const { data: userList } = await client.auth.admin.listUsers();
    const existing = userList?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existing) {
      const { error } = await client.auth.admin.updateUserById(existing.id, {
        password: newPassword,
        email_confirm: true,
        ...(metadata ? { user_metadata: { ...existing.user_metadata, ...metadata } } : {}),
      });
      if (error) {
        console.warn('Supabase updateUserById by email error:', error.message);
        return false;
      }
      return true;
    } else {
      // Provision user account in Supabase Auth
      const { error } = await client.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
        user_metadata: metadata || {},
      });
      if (error) {
        console.warn('Supabase createUser for password reset error:', error.message);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.warn('Failed to update password in Supabase Auth by email:', err);
    return false;
  }
}

/**
 * Saves a hashed OTP record to Supabase table `password_reset_otps`.
 * Note: Plaintext OTP is NEVER stored in database.
 */
export async function saveOtpRecordToSupabase(params: {
  id: string;
  userId: string;
  otpHash: string;
  expiresAt: string;
}): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  try {
    // Invalidate previous OTP records for this user in Supabase
    await client
      .from('password_reset_otps')
      .update({ verified: false, used_at: new Date().toISOString() })
      .eq('user_id', params.userId)
      .is('used_at', null);

    // Insert new hashed record
    const { error } = await client.from('password_reset_otps').insert({
      id: params.id,
      user_id: params.userId,
      otp_hash: params.otpHash,
      expires_at: params.expiresAt,
      attempts: 0,
      verified: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // If table does not exist or schema cache notice, log gently and proceed with resilient server store
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Updates OTP attempts in Supabase table.
 */
export async function updateOtpAttemptsInSupabase(
  id: string,
  attempts: number,
  invalidate: boolean = false
): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;

  try {
    const payload: Record<string, any> = { attempts };
    if (invalidate) {
      payload.used_at = new Date().toISOString();
      payload.verified = false;
    }
    await client.from('password_reset_otps').update(payload).eq('id', id);
  } catch {
    // Silently continue
  }
}

/**
 * Marks OTP record as verified in Supabase table.
 */
export async function markOtpVerifiedInSupabase(id: string): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;

  try {
    await client
      .from('password_reset_otps')
      .update({ verified: true })
      .eq('id', id);
  } catch {
    // Silently continue
  }
}

/**
 * Marks OTP record as used in Supabase table.
 */
export async function markOtpUsedInSupabase(id: string): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;

  try {
    await client
      .from('password_reset_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', id);
  } catch {
    // Silently continue
  }
}


