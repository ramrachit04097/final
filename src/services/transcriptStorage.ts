/**
 * MeetFlow Cloud Transcript Storage Adapter
 * Integrates directly with Supabase Cloud PostgreSQL and Storage
 * Replaces previous 7-day local-only storage with persistent enterprise retention.
 */

import { TranscriptRecord } from '../types';
import { transcriptService } from './transcriptService';

export const transcriptStorage = {
  /**
   * Save a newly recorded or uploaded transcript to Supabase Cloud Database.
   */
  async saveTranscript(
    data: Omit<TranscriptRecord, 'id' | 'recordedAt' | 'expiresAt'> & { id?: string; recordedAt?: string }
  ): Promise<TranscriptRecord> {
    return transcriptService.saveTranscript(data);
  },

  /**
   * Retrieve all transcripts for the specified company from Supabase Cloud Database.
   */
  async getTranscripts(companyId: string): Promise<TranscriptRecord[]> {
    return transcriptService.getTranscripts(companyId);
  },

  /**
   * Get a single transcript by ID from Supabase Cloud Database.
   */
  async getTranscriptById(id: string): Promise<TranscriptRecord | null> {
    return transcriptService.getTranscriptById(id);
  },

  /**
   * Update fields on an existing transcript.
   */
  async updateTranscript(id: string, updates: Partial<TranscriptRecord>): Promise<TranscriptRecord | null> {
    return transcriptService.updateTranscript(id, updates);
  },

  /**
   * Delete transcript from Supabase Cloud Database.
   */
  async deleteTranscript(id: string): Promise<void> {
    return transcriptService.deleteTranscript(id);
  },

  /**
   * Upload audio to Supabase Storage.
   */
  async uploadAudio(blob: Blob, filename: string): Promise<string | null> {
    return transcriptService.uploadAudio(blob, filename);
  },

  /**
   * Get public URL for playback from Supabase Storage.
   */
  getAudioUrl(storagePath: string): string | null {
    return transcriptService.getAudioUrl(storagePath);
  },

  /**
   * Format time remaining helper (for display compatibility).
   */
  formatTimeRemaining(expiresAt?: string): { text: string; isUrgent: boolean } {
    if (!expiresAt) return { text: 'Cloud Stored', isUrgent: false };
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { text: 'Cloud Stored', isUrgent: false };
    const days = Math.floor(diff / (24 * 3600 * 1000));
    if (days > 7) return { text: 'Cloud Stored', isUrgent: false };
    if (days > 1) return { text: `${days}d retained`, isUrgent: false };
    const hours = Math.floor(diff / (3600 * 1000));
    return { text: `${hours}h retained`, isUrgent: false };
  },
};
