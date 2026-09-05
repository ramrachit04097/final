import {
  AuthUser,
  LoginFormData,
  ManagerRegisterFormData,
  EmployeeRegisterFormData,
  EmployeeRegistrationRequest,
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const TOKEN_KEY = 'meetflow_auth_token';
const USER_KEY = 'meetflow_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const authService = {
  async getCompanies(): Promise<{ id: string; name: string; email: string }[]> {
    const res = await fetch('/api/companies');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch companies.');
    }
    return data.companies || [];
  },

  async checkUserIdAvailability(userId: string): Promise<{ available: boolean; message: string }> {
    if (!userId.trim()) {
      return { available: false, message: 'User ID cannot be empty.' };
    }
    const res = await fetch(`/api/auth/check-user-id?userId=${encodeURIComponent(userId.trim())}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { available: false, message: data.message || data.error || 'Could not verify User ID.' };
    }
    return data;
  },

  async checkUserExists(userId: string): Promise<{ exists: boolean; role?: string; userId?: string }> {
    if (!userId.trim()) {
      throw new Error('Please enter your User ID.');
    }
    const res = await fetch(`/api/auth/check-user-exists?userId=${encodeURIComponent(userId.trim())}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'User not found');
    }
    return data;
  },

  async registerManager(formData: ManagerRegisterFormData): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/register-manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to register manager account.');
    }

    return data;
  },

  async registerEmployee(formData: EmployeeRegisterFormData): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/register-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit registration request.');
    }

    return data;
  },

  async login(credentials: LoginFormData): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Login failed. Please verify your credentials.');
      (err as any).status = res.status;
      (err as any).registrationStatus = data.status;
      throw err;
    }

    setStoredSession(data.token, data.user);
    return data;
  },

  async initiateForgotPassword(userId: string): Promise<{
    sessionId: string;
    maskedEmail: string;
    message: string;
  }> {
    const res = await fetch('/api/auth/forgot-password/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to initiate password reset.');
    }

    return data;
  },

  async verifyResetOtp(
    sessionId: string,
    otp: string
  ): Promise<{ success: boolean; resetToken: string; message: string }> {
    const res = await fetch('/api/auth/forgot-password/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, otp }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Incorrect or expired OTP.');
    }

    return data;
  },

  async resendResetOtp(sessionId: string): Promise<{
    sessionId: string;
    maskedEmail: string;
    message: string;
  }> {
    const res = await fetch('/api/auth/forgot-password/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to resend OTP.');
    }

    return data;
  },

  async resetPassword(params: {
    resetToken: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/forgot-password/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password.');
    }

    return data;
  },

  async getEmployeeRequests(): Promise<EmployeeRegistrationRequest[]> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/employee-requests', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch employee requests.');
    }
    return data.requests || [];
  },

  async approveEmployeeRequest(requestId: string): Promise<{ success: boolean; message: string }> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/employee-requests/${requestId}/approve`, {
      method: 'POST',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to approve employee request.');
    }
    return data;
  },

  async denyEmployeeRequest(requestId: string): Promise<{ success: boolean; message: string }> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/employee-requests/${requestId}/deny`, {
      method: 'POST',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to deny employee request.');
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      await fetch('/api/auth/logout', { method: 'POST', headers }).catch(() => {});
    } finally {
      clearStoredSession();
    }
  },

  async getMe(): Promise<AuthUser> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/auth/me', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Session expired.');
    }

    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },
};
