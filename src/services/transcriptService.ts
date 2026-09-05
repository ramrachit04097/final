import { TranscriptRecord } from '../types';
import { getStoredToken } from './authService';
import { supabase, isSupabaseConfigured } from './supabase';

export const transcriptService = {
  /**
   * Save a newly recorded or uploaded transcript to Supabase Cloud Database.
   */
  async saveTranscript(
    data: Omit<TranscriptRecord, 'id' | 'recordedAt' | 'expiresAt'> & {
      id?: string;
      recordedAt?: string;
      expiresAt?: string;
    }
  ): Promise<TranscriptRecord> {
    const recordedAt = data.recordedAt || new Date().toISOString();
    // Default expiration is optional or far-future cloud retention (e.g. 1 year or permanent)
    const farFutureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const expiresAt = data.expiresAt || farFutureDate;

    // 1. If Supabase client configured, try inserting into transcripts table
    if (isSupabaseConfigured() && supabase) {
      try {
        const payload: Record<string, any> = {
          meeting_title: data.meetingTitle,
          transcript_text: data.transcriptText,
          duration_seconds: data.durationSeconds || 0,
          recorded_at: recordedAt,
          summary: data.summary || null,
          key_points: data.keyPoints || [],
          speakers: data.speakers || [],
          action_items: data.actionItems || [],
          status: data.status || 'pending_review',
        };

        if (data.meetingId) payload.meeting_id = data.meetingId;
        if (data.companyId && data.companyId !== 'current') payload.company_id = data.companyId;

        const { data: inserted, error } = await supabase
          .from('transcripts')
          .insert(payload)
          .select()
          .single();

        if (!error && inserted) {
          return {
            id: inserted.id,
            companyId: inserted.company_id,
            meetingId: inserted.meeting_id,
            meetingTitle: inserted.meeting_title,
            recordedAt: inserted.recorded_at,
            expiresAt,
            durationSeconds: inserted.duration_seconds,
            transcriptText: inserted.transcript_text,
            summary: inserted.summary,
            keyPoints: inserted.key_points,
            speakers: inserted.speakers,
            actionItems: inserted.action_items,
            status: inserted.status,
          };
        }
      } catch (err) {
        console.warn('Direct Supabase transcript save failed, using server API:', err);
      }
    }

    // 2. Server API fallback / proxy
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/transcripts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...data,
        recordedAt,
        expiresAt,
      }),
    });

    const respData = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(respData.error || 'Failed to save transcript to cloud database');
    return respData.transcript;
  },

  /**
   * Fetch all transcripts for company from Supabase Cloud Database.
   */
  async getTranscripts(companyId?: string): Promise<TranscriptRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('transcripts').select('*').order('recorded_at', { ascending: false });
        if (companyId && companyId !== 'current') {
          query = query.eq('company_id', companyId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((t) => ({
            id: t.id,
            companyId: t.company_id,
            meetingId: t.meeting_id,
            meetingTitle: t.meeting_title,
            recordedAt: t.recorded_at,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            durationSeconds: t.duration_seconds,
            transcriptText: t.transcript_text,
            summary: t.summary,
            keyPoints: t.key_points,
            speakers: t.speakers,
            actionItems: t.action_items,
            status: t.status,
          }));
        }
      } catch (err) {
        console.warn('Direct Supabase fetch transcripts failed, falling back to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/transcripts', { headers });
    const respData = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(respData.error || 'Failed to fetch transcripts');
    return respData.transcripts || [];
  },

  /**
   * Get single transcript by ID.
   */
  async getTranscriptById(id: string): Promise<TranscriptRecord | null> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('transcripts')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            companyId: data.company_id,
            meetingId: data.meeting_id,
            meetingTitle: data.meeting_title,
            recordedAt: data.recorded_at,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            durationSeconds: data.duration_seconds,
            transcriptText: data.transcript_text,
            summary: data.summary,
            keyPoints: data.key_points,
            speakers: data.speakers,
            actionItems: data.action_items,
            status: data.status,
          };
        }
      } catch (err) {
        console.warn('Direct Supabase fetch transcript by id failed:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/transcripts/${id}`, { headers });
    if (!res.ok) return null;
    const respData = await res.json().catch(() => ({}));
    return respData.transcript || null;
  },

  /**
   * Update fields on an existing transcript.
   */
  async updateTranscript(id: string, updates: Partial<TranscriptRecord>): Promise<TranscriptRecord | null> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.summary !== undefined) payload.summary = updates.summary;
        if (updates.keyPoints !== undefined) payload.key_points = updates.keyPoints;
        if (updates.actionItems !== undefined) payload.action_items = updates.actionItems;
        if (updates.status !== undefined) payload.status = updates.status;

        const { data, error } = await supabase
          .from('transcripts')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            companyId: data.company_id,
            meetingId: data.meeting_id,
            meetingTitle: data.meeting_title,
            recordedAt: data.recorded_at,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            durationSeconds: data.duration_seconds,
            transcriptText: data.transcript_text,
            summary: data.summary,
            keyPoints: data.key_points,
            speakers: data.speakers,
            actionItems: data.action_items,
            status: data.status,
          };
        }
      } catch (err) {
        console.warn('Direct Supabase update transcript failed, falling back to API:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/transcripts/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    const respData = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(respData.error || 'Failed to update transcript');
    return respData.transcript;
  },

  /**
   * Delete transcript.
   */
  async deleteTranscript(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('transcripts').delete().eq('id', id);
        if (!error) return;
      } catch (err) {
        console.warn('Direct Supabase delete transcript failed:', err);
      }
    }

    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/transcripts/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const respData = await res.json().catch(() => ({}));
      throw new Error(respData.error || 'Failed to delete transcript');
    }
  },

  /**
   * Upload meeting audio to Supabase Storage bucket 'meeting-audio'.
   */
  async uploadAudio(blob: Blob, filename: string): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const path = `recordings/${Date.now()}_${filename}`;
      const { data, error } = await supabase.storage.from('meeting-audio').upload(path, blob, {
        contentType: blob.type || 'audio/webm',
        upsert: true,
      });

      if (error) {
        console.warn('Supabase storage upload error:', error);
        return null;
      }

      return data.path;
    } catch (err) {
      console.warn('Failed to upload audio to Supabase storage:', err);
      return null;
    }
  },

  /**
   * Get public or signed URL for playback from Supabase Storage.
   */
  getAudioUrl(storagePath: string): string | null {
    if (!isSupabaseConfigured() || !supabase || !storagePath) return null;
    try {
      const { data } = supabase.storage.from('meeting-audio').getPublicUrl(storagePath);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  },
};
