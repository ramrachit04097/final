import { TaskItem, TaskStatus } from '../types';
import { getStoredToken, getStoredUser } from './authService';
import { supabase, isSupabaseConfigured } from './supabase';

function computeDynamicStatus(storedStatus: TaskStatus, deadline: string): TaskStatus {
  if (storedStatus === 'Completed') return 'Completed';
  const today = new Date().toISOString().split('T')[0];
  if (deadline && deadline < today) {
    return 'Overdue';
  }
  return storedStatus;
}

export const taskService = {
  async getTasks(): Promise<TaskItem[]> {
    const user = getStoredUser();

    if (isSupabaseConfigured() && supabase && user) {
      try {
        let query = supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (user.companyId) {
          query = query.eq('company_id', user.companyId);
        }

        // Critical Task Privacy: If Employee, ONLY select own tasks
        if (user.role === 'Employee') {
          query = query.eq('employee_id', user.userId || user.id);
        }

        const { data, error } = await query;

        if (!error && data) {
          return data.map((t) => ({
            id: t.id,
            companyId: t.company_id,
            employeeId: t.employee_id,
            employeeName: t.employee_name,
            employeePost: t.employee_post || 'Team Member',
            subject: t.subject,
            description: t.description || undefined,
            assignedDate: t.assigned_date,
            deadline: t.deadline,
            status: computeDynamicStatus(t.status as TaskStatus, t.deadline),
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          }));
        }
      } catch (err) {
        console.warn('Direct Supabase fetch tasks failed, falling back to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/tasks', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tasks');
    return (data.tasks || []).map((t: TaskItem) => ({
      ...t,
      status: computeDynamicStatus(t.status, t.deadline),
    }));
  },

  async addTask(params: {
    employeeId: string;
    subject: string;
    description?: string;
    assignedDate: string;
    deadline: string;
    status?: string;
  }): Promise<TaskItem> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to create task');
    return data.task;
  },

  async updateTask(
    taskId: string,
    updates: {
      employeeId?: string;
      employeeName?: string;
      employeePost?: string;
      subject?: string;
      description?: string;
      assignedDate?: string;
      deadline?: string;
      status?: string;
    }
  ): Promise<TaskItem> {
    // If Supabase client configured, we can also update directly if session active
    if (isSupabaseConfigured() && supabase) {
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.employeeId) payload.employee_id = updates.employeeId;
        if (updates.employeeName) payload.employee_name = updates.employeeName;
        if (updates.employeePost) payload.employee_post = updates.employeePost;
        if (updates.subject !== undefined) payload.subject = updates.subject;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.assignedDate) payload.assigned_date = updates.assignedDate;
        if (updates.deadline) payload.deadline = updates.deadline;
        if (updates.status) {
          payload.status = updates.status;
          if (updates.status === 'Completed') {
            payload.completed_at = new Date().toISOString();
          }
        }

        const { data, error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', taskId)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            companyId: data.company_id,
            employeeId: data.employee_id,
            employeeName: data.employee_name,
            employeePost: data.employee_post || 'Team Member',
            subject: data.subject,
            description: data.description || undefined,
            assignedDate: data.assigned_date,
            deadline: data.deadline,
            status: computeDynamicStatus(data.status as TaskStatus, data.deadline),
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn('Direct Supabase task update fallback to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update task');
    return data.task;
  },

  async deleteTask(taskId: string): Promise<void> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete task');
    }
  },

  async bulkCreateTasks(
    tasks: Array<{
      employeeId: string;
      subject: string;
      assignedDate?: string;
      deadline: string;
      priority?: string;
    }>
  ): Promise<{ success: boolean; count: number; tasks: TaskItem[] }> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/tasks/bulk-create', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tasks }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to bulk-create tasks');
    return data;
  },
};
