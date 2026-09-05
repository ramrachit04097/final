import { AlertItem } from '../types';
import { getStoredToken } from './authService';
import { supabase, isSupabaseConfigured } from './supabase';

export const alertService = {
  async getAlerts(): Promise<AlertItem[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((a) => ({
            id: a.id,
            companyId: a.company_id,
            recipientRole: a.recipient_role,
            recipientId: a.recipient_id,
            type: a.type,
            title: a.title,
            description: a.description,
            severity: a.severity,
            createdAt: a.created_at,
            read: a.read,
            relatedTaskId: a.related_task_id,
            relatedMeetingId: a.related_meeting_id,
          }));
        }
      } catch (err) {
        console.warn('Direct Supabase fetch alerts failed, falling back to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/alerts', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch alerts');
    return data.alerts || [];
  },

  async markAlertRead(alertId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase
          .from('alerts')
          .update({ read: true })
          .eq('id', alertId);

        if (!error) return;
      } catch (err) {
        console.warn('Direct Supabase mark alert read failed:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`/api/alerts/${alertId}/read`, {
      method: 'POST',
      headers,
    });
  },
};
