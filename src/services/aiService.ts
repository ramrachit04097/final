import { AIAnalysisResult, SpeakerUtterance, EmployeeUser } from '../types';
import { getStoredToken } from './authService';

export const aiService = {
  /**
   * Secure server-side call to Google Gemini AI API for meeting transcript analysis and action item extraction.
   * API Key is strictly server-side and never exposed to the client.
   */
  async analyzeTranscript(params: {
    meetingTitle: string;
    meetingDate?: string;
    transcriptText: string;
    employees?: EmployeeUser[];
    attendees?: string[];
  }): Promise<AIAnalysisResult> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // POST to /api/ai/analyze-transcript (with fallback to /api/meetings/analyze-transcript if needed)
    const res = await fetch('/api/ai/analyze-transcript', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'AI transcript analysis failed.');
    }

    return {
      meetingSummary: data.meetingSummary || '',
      keyDiscussionPoints: data.keyDiscussionPoints || [],
      actionItems: data.actionItems || [],
    };
  },

  /**
   * Meeting audio transcription via server
   */
  async transcribeMeetingAudio(params: {
    audioBase64?: string;
    liveTranscript?: string;
    meetingTitle?: string;
  }): Promise<{
    success: boolean;
    transcriptText: string;
    speakers: SpeakerUtterance[];
    durationSeconds?: number;
    apiKeyNotice?: string;
    apiKeyMissing?: boolean;
    message?: string;
  }> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/meetings/transcribe', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Transcription processing failed.');
    }

    return data;
  },

  /**
   * Chat with Meeting Transcript AI via server-side Gemini API.
   * Scoped strictly to the selected meeting's raw transcript.
   * API Key is strictly server-side and never exposed.
   */
  async chatWithTranscript(params: {
    transcriptId: string;
    question: string;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
    meetingTitle?: string;
    meetingDate?: string;
    durationSeconds?: number;
    rawTranscriptText?: string;
  }): Promise<{ answer: string }> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/ai/chat-transcript', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Sorry, I couldn't process that right now. Please try again.");
    }

    return {
      answer: data.answer || "I couldn't find that information in this meeting transcript.",
    };
  },

  /**
   * MeetFlow Global Floating AI Assistant
   * Role-aware meeting, task, employee, and alerts assistant.
   * Scoped securely to current authenticated role and user.
   */
  async chatWithAssistant(params: {
    question: string;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
  }): Promise<{ answer: string }> {
    const token = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/ai/assistant-chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Sorry, I couldn't process that right now. Please try again.");
    }

    return {
      answer: data.answer || "I couldn't find that information in your MeetFlow data.",
    };
  },
};
