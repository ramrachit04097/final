import { EmployeeUser } from '../types';
import { getStoredToken } from './authService';
import { supabase, isSupabaseConfigured } from './supabase';

export const employeeService = {
  async getEmployees(): Promise<EmployeeUser[]> {
    // If Supabase is configured and user is logged in, we can attempt direct Supabase query with fallback to API
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('employee_name', { ascending: true });

        if (!error && data) {
          return data.map((e) => ({
            id: e.id,
            employeeId: e.employee_id,
            employeeName: e.employee_name,
            employeePost: e.employee_post || 'Team Member',
            companyId: e.company_id,
            role: 'Employee',
            status: e.status,
            createdAt: e.created_at,
            lastLogin: e.last_login,
          }));
        }
      } catch (err) {
        console.warn('Direct Supabase fetch failed, falling back to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/employees', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch employees');
    return data.employees || [];
  },

  async addEmployee(params: {
    employeeName: string;
    employeeId: string;
    employeePost: string;
    password: string;
  }): Promise<EmployeeUser> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to add employee');
    return data.employee;
  },

  async deleteEmployee(employeeId: string): Promise<void> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/employees/${employeeId}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete employee');
    }
  },
};
