import { MeetingItem } from '../types';
import { getStoredToken } from './authService';
import { supabase, isSupabaseConfigured } from './supabase';

export const meetingService = {
  async getMeetings(): Promise<MeetingItem[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .order('meeting_date', { ascending: true });

        if (!error && data) {
          return data.map((m) => ({
            id: m.id,
            companyId: m.company_id,
            title: m.title,
            date: m.meeting_date,
            time: m.meeting_time,
            durationMinutes: m.duration_minutes,
            createdAt: m.created_at,
          }));
        }
      } catch (err) {
        console.warn('Direct Supabase fetch meetings failed, falling back to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/meetings', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to fetch meetings');
    return data.meetings || [];
  },

  async addMeeting(params: {
    title: string;
    date: string;
    time: string;
    durationMinutes: number;
  }): Promise<MeetingItem> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to schedule meeting');
    return data.meeting;
  },

  async deleteMeeting(meetingId: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('meetings').delete().eq('id', meetingId);
      } catch (err) {
        console.warn('Direct Supabase delete meeting failed, falling back to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete meeting');
    return true;
  },
};
